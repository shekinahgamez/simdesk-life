import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { cloudBackend, localBackend, type Backend, type StoredRecord } from '../data/backend';
import { supabase } from '../lib/supabase';
import { nowIso, uid } from '../lib/ids';
import type { CustomTrait, RecordKind, RecordMap, Save } from '../lib/types';

type Maps = { [K in RecordKind]: Record<string, RecordMap[K]> };
const emptyMaps = (): Maps => ({ sim: {}, household: {}, relationship: {}, world: {}, lot: {}, holiday: {}, club: {} });

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface State {
  ready: boolean;
  session: Session | null;
  backend: Backend | null;
  saves: Save[];
  savesLoaded: boolean;
  currentSaveId: string | null;
  loadingSave: boolean;
  recs: Maps;
  customTraits: CustomTrait[];
  sync: SyncStatus;
  syncError: string | null;
}

interface Actions {
  init(): Promise<void>;
  startGuest(): Promise<void>;
  signOut(): Promise<void>;
  openSave(id: string): Promise<void>;
  createSave(save: Save): Promise<void>;
  updateSave(patch: Partial<Save>): void;
  deleteSave(id: string): Promise<void>;
  upsert<K extends RecordKind>(kind: K, rec: RecordMap[K]): void;
  upsertMany<K extends RecordKind>(kind: K, recs: RecordMap[K][]): void;
  remove(kind: RecordKind, id: string): void;
  saveCustomTraits(t: CustomTrait[]): void;
  deleteCustomTrait(id: string): void;
  uploadImage(file: Blob, opts?: { maxSide?: number }): Promise<string>;
  refresh(): Promise<void>;
}

const GUEST_KEY = 'sd:guest';

// ---- write queue: batches rapid edits (typing) into one write per record ----
const pending = new Map<string, StoredRecord>();
const pendingDeletes = new Set<string>();
let pendingSave: Save | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> = Promise.resolve();

// ---- outbox: a synchronous copy of unsent edits, so closing the tab mid-save never loses work ----
interface Outbox {
  owner: string;
  saveId: string;
  recs: StoredRecord[];
  dels: string[];
  save: Save | null;
}
const OUTBOX = 'sd:outbox';
let outboxOwner = '';
function writeOutbox(saveId: string | null) {
  try {
    if (!saveId || (!pending.size && !pendingDeletes.size && !pendingSave)) {
      localStorage.removeItem(OUTBOX);
      return;
    }
    const box: Outbox = { owner: outboxOwner, saveId, recs: [...pending.values()], dels: [...pendingDeletes], save: pendingSave };
    localStorage.setItem(OUTBOX, JSON.stringify(box));
  } catch {
    /* storage full or blocked: the normal save still runs */
  }
}
async function replayOutbox(backend: Backend) {
  let box: Outbox | null = null;
  try {
    box = JSON.parse(localStorage.getItem(OUTBOX) ?? 'null');
  } catch {
    box = null;
  }
  if (!box || box.owner !== outboxOwner) return;
  if (box.save) await backend.putSave(box.save);
  if (box.recs.length) await backend.putRecords(box.saveId, box.recs);
  if (box.dels.length) await backend.deleteRecords(box.saveId, box.dels);
  localStorage.removeItem(OUTBOX);
}

export const useStore = create<State & Actions>((set, getState) => {
  const schedule = () => {
    set({ sync: 'saving' });
    writeOutbox(getState().currentSaveId);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 450);
  };

  /** Sends queued edits. Runs one at a time so overlapping saves can't overwrite each other. */
  function flush() {
    timer = null;
    flushing = flushing.then(doFlush);
    return flushing;
  }

  async function doFlush() {
    const { backend, currentSaveId } = getState();
    if (!backend || !currentSaveId) return;
    const recs = [...pending.values()];
    const dels = [...pendingDeletes];
    const save = pendingSave;
    pending.clear();
    pendingDeletes.clear();
    pendingSave = null;
    try {
      if (save) await backend.putSave(save);
      if (recs.length) await backend.putRecords(currentSaveId, recs);
      if (dels.length) await backend.deleteRecords(currentSaveId, dels);
      writeOutbox(currentSaveId);
      if (!timer) set({ sync: 'saved', syncError: null });
    } catch (e) {
      // put them back so the next edit (or retry) sends them again
      for (const r of recs) if (!pending.has(r.id)) pending.set(r.id, r);
      for (const d of dels) pendingDeletes.add(d);
      if (save && !pendingSave) pendingSave = save;
      set({ sync: 'error', syncError: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
      setTimeout(() => {
        if (pending.size || pendingDeletes.size || pendingSave) schedule();
      }, 5000);
    }
  }

  async function useBackend(backend: Backend, owner: string) {
    outboxOwner = owner;
    set({ backend, savesLoaded: false, currentSaveId: null, recs: emptyMaps() });
    try {
      await replayOutbox(backend);
    } catch {
      /* offline: it stays in the outbox for next time */
    }
    const [saves, customTraits] = await Promise.all([backend.listSaves(), backend.listCustomTraits()]);
    set({ saves, customTraits, savesLoaded: true });
  }

  return {
    ready: false,
    session: null,
    backend: null,
    saves: [],
    savesLoaded: false,
    currentSaveId: null,
    loadingSave: false,
    recs: emptyMaps(),
    customTraits: [],
    sync: 'idle',
    syncError: null,

    async init() {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        set({ session });
        supabase.auth.onAuthStateChange((evt, s) => {
          // Arrived from a "reset your password" email: go to Account, where the new password is set.
          if (evt === 'PASSWORD_RECOVERY') window.location.hash = '#/account';
          const prev = getState().session;
          set({ session: s });
          if (s && s.user.id !== prev?.user.id) {
            localStorage.removeItem(GUEST_KEY);
            void useBackend(cloudBackend(s.user.id), s.user.id);
          } else if (!s && prev) {
            set({ backend: null, saves: [], savesLoaded: false, currentSaveId: null, recs: emptyMaps() });
          }
        });
        if (session) await useBackend(cloudBackend(session.user.id), session.user.id);
      }
      if (!getState().backend && localStorage.getItem(GUEST_KEY)) await useBackend(localBackend(), 'guest');
      set({ ready: true });

      const onWake = () => {
        if (document.visibilityState === 'visible') void getState().refresh();
      };
      document.addEventListener('visibilitychange', onWake);
      window.addEventListener('pagehide', () => {
        if (pending.size || pendingSave || pendingDeletes.size) void flush();
      });
    },

    async startGuest() {
      localStorage.setItem(GUEST_KEY, '1');
      await useBackend(localBackend(), 'guest');
    },

    async signOut() {
      if (timer) {
        clearTimeout(timer);
        void flush();
      }
      await flushing;
      localStorage.removeItem(GUEST_KEY);
      if (supabase && getState().session) await supabase.auth.signOut();
      set({ backend: null, saves: [], savesLoaded: false, currentSaveId: null, recs: emptyMaps(), session: null });
    },

    async openSave(id) {
      const { backend, currentSaveId } = getState();
      if (!backend || currentSaveId === id) return;
      if (timer) {
        clearTimeout(timer);
        void flush();
      }
      await flushing;
      set({ loadingSave: true, currentSaveId: id });
      const rows = await backend.loadRecords(id);
      const recs = emptyMaps();
      for (const r of rows) {
        const bucket = recs[r.kind] as Record<string, unknown> | undefined;
        if (bucket) bucket[r.id] = { ...(r.data as object), id: r.id };
      }
      if (getState().currentSaveId === id) set({ recs, loadingSave: false });
      try {
        localStorage.setItem('sd:lastSave', id);
      } catch {
        /* private mode */
      }
    },

    async createSave(save) {
      const { backend } = getState();
      if (!backend) throw new Error('Not signed in');
      await backend.putSave(save);
      set({ saves: [...getState().saves, save] });
      await getState().openSave(save.id);
    },

    updateSave(patch) {
      const { currentSaveId, saves } = getState();
      const cur = saves.find((s) => s.id === currentSaveId);
      if (!cur) return;
      const next = { ...cur, ...patch, updatedAt: nowIso() };
      set({ saves: saves.map((s) => (s.id === cur.id ? next : s)) });
      pendingSave = next;
      schedule();
    },

    async deleteSave(id) {
      const { backend } = getState();
      if (!backend) return;
      await backend.deleteSave(id);
      set({ saves: getState().saves.filter((s) => s.id !== id) });
      if (getState().currentSaveId === id) set({ currentSaveId: null, recs: emptyMaps() });
    },

    upsert(kind, rec) {
      getState().upsertMany(kind, [rec]);
    },

    upsertMany(kind, list) {
      const recs = getState().recs;
      const bucket = { ...(recs[kind] as Record<string, RecordMap[typeof kind]>) };
      for (const rec of list) {
        bucket[rec.id] = rec;
        pendingDeletes.delete(rec.id);
        const { id, ...data } = rec as { id: string };
        pending.set(rec.id, { id, kind, data });
      }
      set({ recs: { ...recs, [kind]: bucket } });
      schedule();
    },

    remove(kind, id) {
      const recs = { ...getState().recs };
      const drop = (k: RecordKind, rid: string) => {
        const b = { ...(recs[k] as Record<string, unknown>) };
        delete b[rid];
        (recs as Record<string, unknown>)[k] = b;
        pending.delete(rid);
        pendingDeletes.add(rid);
      };
      const touch = <K extends RecordKind>(k: K, r: RecordMap[K]) => {
        (recs[k] as Record<string, RecordMap[K]>) = { ...(recs[k] as Record<string, RecordMap[K]>), [r.id]: r };
        const { id: rid, ...data } = r as { id: string };
        pending.set(rid, { id: rid, kind: k, data });
      };
      drop(kind, id);
      // Tidy up anything pointing at what was removed.
      if (kind === 'sim') {
        for (const r of Object.values(recs.relationship)) if (r.a === id || r.b === id) drop('relationship', r.id);
        for (const c of Object.values(recs.club))
          if (c.members.some((m) => m.simId === id)) touch('club', { ...c, members: c.members.filter((m) => m.simId !== id) });
      }
      if (kind === 'household') {
        for (const s of Object.values(recs.sim)) if (s.householdId === id) touch('sim', { ...s, householdId: undefined });
      }
      if (kind === 'lot') {
        for (const h of Object.values(recs.household)) if (h.homeLotId === id) touch('household', { ...h, homeLotId: undefined });
        for (const c of Object.values(recs.club)) if (c.lotId === id) touch('club', { ...c, lotId: undefined });
      }
      if (kind === 'club') {
        for (const c of Object.values(recs.club))
          if (c.linkedClubIds.includes(id)) touch('club', { ...c, linkedClubIds: c.linkedClubIds.filter((x) => x !== id) });
      }
      set({ recs });
      schedule();
    },

    saveCustomTraits(t) {
      const { backend, customTraits } = getState();
      const map = new Map(customTraits.map((x) => [x.id, x]));
      for (const x of t) map.set(x.id, x);
      set({ customTraits: [...map.values()] });
      void backend?.putCustomTraits(t).catch((e) => set({ sync: 'error', syncError: String(e?.message ?? e) }));
    },

    deleteCustomTrait(id) {
      const { backend, customTraits } = getState();
      set({ customTraits: customTraits.filter((x) => x.id !== id) });
      void backend?.deleteCustomTrait(id);
    },

    uploadImage(file, opts) {
      const { backend } = getState();
      if (!backend) return Promise.reject(new Error('Not signed in'));
      return backend.uploadImage(file, opts);
    },

    /** Pull fresh data (other devices may have changed things). Skips if local edits are still sending. */
    async refresh() {
      const { backend, currentSaveId } = getState();
      if (!backend || backend.mode !== 'cloud' || timer || pending.size) return;
      try {
        const saves = await backend.listSaves();
        set({ saves });
        if (currentSaveId) {
          const rows = await backend.loadRecords(currentSaveId);
          if (timer || pending.size) return;
          const recs = emptyMaps();
          for (const r of rows) {
            const bucket = recs[r.kind] as Record<string, unknown> | undefined;
            if (bucket) bucket[r.id] = { ...(r.data as object), id: r.id };
          }
          set({ recs });
        }
      } catch {
        /* offline; try again next time */
      }
    },
  };
});

// ---------- selectors ----------

export const useSave = () =>
  useStore((s) => s.saves.find((x) => x.id === s.currentSaveId) ?? null);

export function newId() {
  return uid();
}
