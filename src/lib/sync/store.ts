import { toast } from '../../components/ui';
import { kvDel, kvDelPrefix, kvGet, kvSet } from './kv';
import {
  DAY, DRAFT_DAYS, GoneError, NetworkError, TRASH_DAYS,
  type Backend, type DraftRow, type Rec, type RemoteEvent, type SaveData, type SaveRow,
} from './types';

/**
 * The saving engine. Every change shows on screen straight away, is kept on this device, then sent
 * to the account in the background. If sending fails (offline, server down) it keeps waiting and
 * retries. Each item saves on its own, and the newest edit of an item wins.
 */

export type Status = 'synced' | 'saving' | 'offline' | 'error';

export const STATUS_TEXT: Record<Status, string> = {
  synced: 'All changes synced',
  saving: 'Saving…',
  offline: 'Offline. Changes are saved on this device.',
  error: 'Couldn’t save. Retrying…',
};

type Persisted = {
  saves: SaveRow[];
  openId: string | null;
  outSaves: SaveRow[];
  outRecs: [string, Rec[]][];
  purgeRecs: [string, string[]][];
  purgeSaves: string[];
  drafts: DraftRow[];
  draftOut: [string, DraftRow | null][];
};

const now = () => new Date().toISOString();
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);
const same = (a: Rec, b: Rec) => a.kind === b.kind && !!a.deleted_at === !!b.deleted_at && JSON.stringify(a.data) === JSON.stringify(b.data);
const sameSave = (a: SaveRow, b: SaveRow) => !!a.deleted_at === !!b.deleted_at && JSON.stringify(a.data) === JSON.stringify(b.data);

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Days left before something in Trash is deleted for good (at least 1 while it's still there). */
export function trashDaysLeft(deletedAt: string): number {
  return Math.max(1, Math.ceil((t(deletedAt) + TRASH_DAYS * DAY - Date.now()) / DAY));
}
/** Days left before a draft expires. */
export function draftDaysLeft(updatedAt: string): number {
  return Math.max(1, Math.ceil((t(updatedAt) + DRAFT_DAYS * DAY - Date.now()) / DAY));
}
const expired = (iso: string | null, days: number) => !!iso && t(iso) + days * DAY < Date.now();

export class SyncStore {
  readonly backend: Backend;
  readonly prefix: string;

  saves = new Map<string, SaveRow>();
  openId: string | null = null;
  records = new Map<string, Rec>();
  /** True once the open save's things are in memory (from this device or the server). */
  ready = false;
  drafts = new Map<string, DraftRow>();
  status: Status = 'synced';
  error = '';
  /** Whether the save list is known yet (from this device or the account). 'error' = nothing to show and can't reach the account. */
  savesState: 'loading' | 'ready' | 'error' = 'loading';
  /** Counts changes that came from another device, per item, so open forms can notice. */
  remoteHits = new Map<string, number>();
  version = 0;

  private outSaves = new Map<string, SaveRow>();
  private outRecs = new Map<string, Map<string, Rec>>();
  private purgeRecs = new Map<string, Set<string>>();
  private purgeSaves = new Set<string>();
  private draftOut = new Map<string, DraftRow | null>();
  private listeners = new Set<() => void>();
  private online = typeof navigator === 'undefined' ? true : navigator.onLine;
  private flushing = false;
  private flushAgain = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private retryMs = 0;
  private stopLive: (() => void) | null = null;
  private stopped = false;
  private cleanup: (() => void)[] = [];

  constructor(backend: Backend, userKey: string) {
    this.backend = backend;
    this.prefix = `sd:${userKey}:`;
  }

  // ---------- listening (for React) ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  // ---------- start / stop ----------
  /** Loads what this device has, then catches up with the account. Safe to call offline. */
  async start(opts: { listenToWindow?: boolean } = {}) {
    const saved = await kvGet<Persisted>(`${this.prefix}state`);
    if (saved) {
      this.saves = new Map(saved.saves.map((s) => [s.id, s]));
      this.openId = saved.openId;
      this.outSaves = new Map(saved.outSaves.map((s) => [s.id, s]));
      this.outRecs = new Map(saved.outRecs.map(([id, recs]) => [id, new Map(recs.map((r) => [r.id, r]))]));
      this.purgeRecs = new Map(saved.purgeRecs.map(([id, ids]) => [id, new Set(ids)]));
      this.purgeSaves = new Set(saved.purgeSaves);
      this.drafts = new Map(saved.drafts.map((d) => [d.key, d]));
      this.draftOut = new Map(saved.draftOut);
    }
    if (saved) this.savesState = 'ready';
    if (this.openId) await this.loadCachedRecords(this.openId);
    if (!this.online) this.status = 'offline';
    if (!this.online && !saved) this.savesState = 'error';
    this.emit();

    if (opts.listenToWindow) {
      const on = () => this.setOnline(true);
      const off = () => this.setOnline(false);
      const vis = () => { if (document.visibilityState === 'visible') this.refresh(); };
      const leaving = (e: BeforeUnloadEvent) => { this.persistNow(); if (this.hasPending()) e.preventDefault(); };
      const hide = () => this.persistNow();
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('beforeunload', leaving);
      window.addEventListener('pagehide', hide);
      this.cleanup.push(() => {
        window.removeEventListener('pagehide', hide);
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('beforeunload', leaving);
      });
    }
    this.stopLive = this.backend.subscribe((e) => this.onRemote(e), () => this.refresh());
    await this.refresh();
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.persistTimer);
    this.stopLive?.();
    for (const c of this.cleanup) c();
    this.listeners.clear();
  }

  /** True when some edits haven't reached the account yet. */
  hasPending(): boolean {
    return this.outSaves.size > 0 || [...this.outRecs.values()].some((m) => m.size > 0)
      || [...this.purgeRecs.values()].some((s) => s.size > 0) || this.purgeSaves.size > 0 || this.draftOut.size > 0;
  }
  pendingCount(): number {
    let n = this.outSaves.size + this.purgeSaves.size + this.draftOut.size;
    for (const m of this.outRecs.values()) n += m.size;
    for (const s of this.purgeRecs.values()) n += s.size;
    return n;
  }

  /** Removes this account's copy from the device (on log out). */
  async wipe() {
    this.stop();
    await kvDelPrefix(this.prefix);
  }

  // ---------- online / offline ----------
  setOnline(on: boolean) {
    if (on === this.online) return;
    this.online = on;
    if (!on) {
      toast('You’re offline. Your changes are saved on this device and will sync when you’re back.');
      this.setStatus('offline');
    } else {
      toast(this.hasPending() ? 'You’re back online. Syncing your changes…' : 'You’re back online.');
      this.retryMs = 0;
      this.refresh();
      this.schedule(0);
    }
  }
  isOnline() { return this.online; }

  private setStatus(s: Status, error = '') {
    if (s === this.status && error === this.error) return;
    this.status = s;
    this.error = error;
    this.emit();
  }

  // ---------- reading from the account ----------
  /** Catches up with the account: the save list, drafts, and the open save's things. */
  async refresh() {
    if (!this.online || this.stopped) return;
    try {
      const [saves, drafts] = await Promise.all([this.backend.listSaves(), this.backend.listDrafts()]);
      this.mergeSaves(saves);
      this.savesState = 'ready';
      this.mergeDrafts(drafts);
      if (this.openId) {
        const id = this.openId;
        const recs = await this.backend.loadRecords(id);
        if (this.openId === id) this.mergeRecords(id, recs, true);
      }
      this.persist();
      this.emit();
    } catch (e) {
      if (this.savesState === 'loading') { this.savesState = 'error'; this.emit(); }
      this.onFail(e);
    }
  }

  /** Try loading again after "Can't reach SimDesk". */
  retry() {
    if (this.savesState === 'error') { this.savesState = 'loading'; this.emit(); }
    this.online = typeof navigator === 'undefined' ? true : navigator.onLine;
    return this.refresh();
  }

  private mergeSaves(rows: SaveRow[]) {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      if (this.outSaves.has(row.id) || this.purgeSaves.has(row.id)) continue;
      const local = this.saves.get(row.id);
      if (!local || t(row.edited_at) >= t(local.edited_at)) this.saves.set(row.id, row);
    }
    // Gone from the account and not waiting to be sent = deleted for good elsewhere.
    for (const id of [...this.saves.keys()]) {
      if (!seen.has(id) && !this.outSaves.has(id)) {
        this.saves.delete(id);
        if (this.openId === id) this.closeSave();
      }
    }
  }

  private mergeDrafts(rows: DraftRow[]) {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.key);
      if (this.draftOut.has(row.key)) continue;
      const local = this.drafts.get(row.key);
      if (!local || t(row.updated_at) >= t(local.updated_at)) this.drafts.set(row.key, row);
    }
    for (const key of [...this.drafts.keys()]) if (!seen.has(key) && !this.draftOut.has(key)) this.drafts.delete(key);
  }

  /** Server rows win unless this device has a newer edit waiting to be sent. */
  private mergeRecords(saveId: string, rows: Rec[], full: boolean) {
    const waiting = this.outRecs.get(saveId);
    const purging = this.purgeRecs.get(saveId);
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      if (waiting?.has(row.id) || purging?.has(row.id)) continue;
      const local = this.records.get(row.id);
      if (!local) {
        this.records.set(row.id, row);
      } else if (t(row.edited_at) >= t(local.edited_at) && !same(local, row)) {
        this.records.set(row.id, row);
        this.markRemote(row.id);
      } else if (t(row.edited_at) > t(local.edited_at)) {
        this.records.set(row.id, row); // same content, the server just has the exact time
      }
    }
    if (full) {
      for (const id of [...this.records.keys()]) {
        if (!seen.has(id) && !waiting?.has(id)) this.records.delete(id);
      }
    }
    this.ready = true;
    this.cacheRecords(saveId);
  }

  private markRemote(id: string) {
    this.remoteHits.set(id, (this.remoteHits.get(id) ?? 0) + 1);
  }

  private onRemote(e: RemoteEvent) {
    if (e.type === 'save') {
      const row = e.save;
      if (this.outSaves.has(row.id) || this.purgeSaves.has(row.id)) return;
      const local = this.saves.get(row.id);
      if (local && t(local.edited_at) > t(row.edited_at)) return;
      this.saves.set(row.id, row);
      if (row.deleted_at && this.openId === row.id) this.closeSave();
      this.persist();
      this.emit();
      return;
    }
    if (e.saveId !== this.openId) return; // picked up when that save is opened
    const row = e.rec;
    const waiting = this.outRecs.get(e.saveId)?.get(row.id);
    if (waiting) return; // our newer edit is on its way; the server decides
    const local = this.records.get(row.id);
    if (local && t(local.edited_at) > t(row.edited_at)) return;
    if (local && same(local, row)) {
      this.records.set(row.id, row); // our own edit coming back
    } else {
      this.records.set(row.id, row);
      if (local) this.markRemote(row.id);
    }
    this.cacheRecords(e.saveId);
    this.emit();
  }

  // ---------- saves ----------
  /** Saves in the save list (not in Trash), newest first. */
  activeSaves(): SaveRow[] {
    return [...this.saves.values()].filter((s) => !s.deleted_at)
      .sort((a, b) => t(b.created_at ?? b.edited_at) - t(a.created_at ?? a.edited_at));
  }
  trashedSaves(): SaveRow[] {
    return [...this.saves.values()].filter((s) => s.deleted_at && !expired(s.deleted_at, TRASH_DAYS))
      .sort((a, b) => t(b.deleted_at) - t(a.deleted_at));
  }

  createSave(data: SaveData): string {
    const row: SaveRow = { id: newId(), data, edited_at: now(), deleted_at: null, created_at: now() };
    this.putSave(row);
    return row.id;
  }

  updateSave(id: string, patch: Partial<SaveData>) {
    const cur = this.saves.get(id);
    if (!cur) return;
    this.putSave({ ...cur, data: { ...cur.data, ...patch }, edited_at: now() });
  }

  /** Moves a whole save to Trash (kept 7 days). */
  trashSave(id: string) {
    const cur = this.saves.get(id);
    if (!cur) return;
    if (this.openId === id) this.closeSave();
    this.putSave({ ...cur, deleted_at: now(), edited_at: now() });
    toast(`${cur.data.name} moved to Trash`, { label: 'Undo', run: () => this.restoreSave(id) });
  }

  restoreSave(id: string) {
    const cur = this.saves.get(id);
    if (!cur) return;
    this.putSave({ ...cur, deleted_at: null, edited_at: now() });
  }

  /** Deletes a save and everything in it for good. */
  deleteSaveForever(id: string) {
    this.saves.delete(id);
    this.outSaves.delete(id);
    this.outRecs.delete(id);
    this.purgeRecs.delete(id);
    this.purgeSaves.add(id);
    for (const [key, d] of [...this.drafts]) if (d.save_id === id) { this.drafts.delete(key); this.draftOut.delete(key); }
    if (this.openId === id) this.closeSave();
    kvDel(`${this.prefix}recs:${id}`);
    this.changed();
  }

  private putSave(row: SaveRow) {
    this.saves.set(row.id, row);
    this.outSaves.set(row.id, row);
    this.changed();
  }

  async openSave(id: string) {
    if (this.openId === id && this.ready) return;
    if (this.cacheTimer) this.writeCache();
    this.openId = id;
    this.records = new Map();
    this.ready = false;
    this.remoteHits = new Map();
    await this.loadCachedRecords(id);
    this.emit();
    this.persist();
    if (this.online) {
      try {
        const recs = await this.backend.loadRecords(id);
        if (this.openId === id) this.mergeRecords(id, recs, true);
        this.emit();
      } catch (e) {
        this.onFail(e);
      }
    }
  }

  closeSave() {
    if (this.cacheTimer) this.writeCache();
    this.openId = null;
    this.records = new Map();
    this.ready = false;
    this.persist();
    this.emit();
  }

  private async loadCachedRecords(id: string) {
    const cached = await kvGet<Rec[]>(`${this.prefix}recs:${id}`);
    if (this.openId !== id) return;
    for (const r of cached ?? []) this.records.set(r.id, r);
    // Edits still waiting to be sent are newer than the cached copy.
    for (const r of this.outRecs.get(id)?.values() ?? []) this.records.set(r.id, r);
    for (const pid of this.purgeRecs.get(id) ?? []) this.records.delete(pid);
    if (cached) this.ready = true;
  }

  /** Everything in a save (for a backup). Uses the account when it can, this device when it can't. */
  async allRecords(saveId: string): Promise<Rec[]> {
    if (saveId === this.openId && this.ready) return [...this.records.values()];
    let recs: Rec[] = (await kvGet<Rec[]>(`${this.prefix}recs:${saveId}`)) ?? [];
    if (this.online) {
      try { recs = await this.backend.loadRecords(saveId); } catch { /* use this device's copy */ }
    }
    const map = new Map(recs.map((r) => [r.id, r]));
    for (const r of this.outRecs.get(saveId)?.values() ?? []) map.set(r.id, r);
    return [...map.values()];
  }

  // ---------- things in the open save ----------
  /** Things of one kind (not in Trash). */
  list(kind: string): Rec[] {
    return [...this.records.values()].filter((r) => r.kind === kind && !r.deleted_at);
  }
  get(id: string): Rec | undefined {
    const r = this.records.get(id);
    return r && !r.deleted_at ? r : undefined;
  }
  /** Things in Trash in the open save, newest first. */
  trash(): Rec[] {
    return [...this.records.values()].filter((r) => r.deleted_at && !expired(r.deleted_at, TRASH_DAYS))
      .sort((a, b) => t(b.deleted_at) - t(a.deleted_at));
  }

  /** Adds or replaces a thing. Returns its id. */
  put(kind: string, data: Record<string, unknown>, id: string = newId()): string {
    const saveId = this.needOpen();
    // Saving something brings it back out of Trash if it was there.
    this.putRec(saveId, { id, kind, data, edited_at: now(), deleted_at: null });
    return id;
  }

  /** Changes every thing of one kind (Trash included) in the open save. Return null to leave one alone. */
  updateAll(kind: string, change: (data: Record<string, unknown>) => Record<string, unknown> | null) {
    const saveId = this.needOpen();
    for (const r of [...this.records.values()]) {
      if (r.kind !== kind) continue;
      const data = change(r.data);
      if (data) this.putRec(saveId, { ...r, data, edited_at: now() });
    }
  }

  /** Moves a thing to Trash with an Undo message. `name` is what the message calls it. */
  moveToTrash(id: string, name: string) {
    const saveId = this.needOpen();
    const cur = this.records.get(id);
    if (!cur) return;
    this.putRec(saveId, { ...cur, deleted_at: now(), edited_at: now() });
    toast(`${name} moved to Trash`, { label: 'Undo', run: () => this.restore(id) });
  }

  restore(id: string) {
    const saveId = this.needOpen();
    const cur = this.records.get(id);
    if (!cur) return;
    this.putRec(saveId, { ...cur, deleted_at: null, edited_at: now() });
  }

  deleteForever(ids: string[]) {
    const saveId = this.needOpen();
    const waiting = this.outRecs.get(saveId);
    const purge = this.purgeRecs.get(saveId) ?? new Set<string>();
    for (const id of ids) {
      this.records.delete(id);
      waiting?.delete(id);
      purge.add(id);
    }
    this.purgeRecs.set(saveId, purge);
    this.cacheRecords(saveId);
    this.changed();
  }

  emptyTrash() {
    this.deleteForever(this.trash().map((r) => r.id));
  }

  private needOpen(): string {
    if (!this.openId) throw new Error('No save is open');
    return this.openId;
  }

  private putRec(saveId: string, rec: Rec) {
    this.records.set(rec.id, rec);
    const m = this.outRecs.get(saveId) ?? new Map<string, Rec>();
    m.set(rec.id, rec);
    this.outRecs.set(saveId, m);
    this.purgeRecs.get(saveId)?.delete(rec.id);
    this.cacheRecords(saveId);
    this.changed();
  }

  // ---------- drafts ----------
  getDraft(key: string): DraftRow | undefined {
    const d = this.drafts.get(key);
    if (d && expired(d.updated_at, DRAFT_DAYS)) return undefined;
    return d;
  }
  setDraft(key: string, data: Record<string, unknown>) {
    const row: DraftRow = { key, save_id: this.openId, data, updated_at: now() };
    this.drafts.set(key, row);
    this.draftOut.set(key, row);
    this.changed(1500);
  }
  clearDraft(key: string) {
    if (!this.drafts.has(key) && !this.draftOut.has(key)) return;
    this.drafts.delete(key);
    this.draftOut.set(key, null);
    this.changed();
  }

  // ---------- sending ----------
  private changed(delay = 450) {
    this.persist();
    this.emit();
    this.schedule(delay);
  }

  private schedule(delay: number) {
    clearTimeout(this.timer);
    if (this.stopped) return;
    if (this.hasPending()) {
      if (!this.online) this.setStatus('offline');
      else if (this.status !== 'error') this.setStatus('saving');
    }
    this.timer = setTimeout(() => this.flush(), delay);
  }

  /** Sends everything that's waiting. */
  async flush(): Promise<void> {
    if (this.stopped) return;
    if (this.flushing) { this.flushAgain = true; return; }
    if (!this.online) { this.setStatus('offline'); return; }
    if (!this.hasPending()) { this.setStatus('synced'); return; }
    this.flushing = true;
    if (this.status !== 'error') this.setStatus('saving');
    try {
      // Saves first, so a save made offline exists before its things arrive.
      for (const [id, sent] of [...this.outSaves]) {
        const row = await this.backend.pushSave(sent);
        if (this.outSaves.get(id) === sent) this.outSaves.delete(id);
        if (!this.outSaves.has(id) && !this.purgeSaves.has(id)) {
          const lost = !sameSave(sent, row);
          this.saves.set(id, row);
          if (lost && row.deleted_at && this.openId === id) this.closeSave();
        }
      }
      for (const id of [...this.purgeSaves]) {
        await this.backend.purgeSave(id);
        this.purgeSaves.delete(id);
      }
      for (const [saveId, waiting] of [...this.outRecs]) {
        const items = [...waiting.values()];
        for (let i = 0; i < items.length; i += 500) {
          const chunk = items.slice(i, i + 500);
          let rows: Rec[];
          try {
            rows = await this.backend.pushRecords(saveId, chunk);
          } catch (e) {
            if (e instanceof GoneError) { this.outRecs.delete(saveId); break; } // that save was deleted for good
            throw e;
          }
          const byId = new Map(rows.map((r) => [r.id, r]));
          for (const sent of chunk) {
            if (waiting.get(sent.id) === sent) waiting.delete(sent.id);
            const row = byId.get(sent.id);
            if (!row || waiting.has(sent.id) || saveId !== this.openId) continue;
            // If the server kept a newer edit from another device, show that one.
            if (!same(sent, row)) this.markRemote(row.id);
            this.records.set(row.id, row);
          }
          if (saveId === this.openId) this.cacheRecords(saveId);
        }
        if (waiting.size === 0) this.outRecs.delete(saveId);
      }
      for (const [saveId, ids] of [...this.purgeRecs]) {
        if (ids.size === 0) { this.purgeRecs.delete(saveId); continue; }
        const list = [...ids];
        await this.backend.purgeRecords(saveId, list);
        for (const id of list) ids.delete(id);
        if (ids.size === 0) this.purgeRecs.delete(saveId);
      }
      for (const [key, d] of [...this.draftOut]) {
        try {
          if (d) await this.backend.putDraft(d);
          else await this.backend.deleteDraft(key);
        } catch (e) {
          if (!(e instanceof GoneError)) throw e; // draft for a save that's gone: drop it
        }
        if (this.draftOut.get(key) === d) this.draftOut.delete(key);
      }
      this.retryMs = 0;
      this.persist();
      this.setStatus(this.hasPending() ? 'saving' : 'synced');
      this.emit();
    } catch (e) {
      this.persist();
      this.onFail(e);
    } finally {
      this.flushing = false;
      if (this.flushAgain) {
        this.flushAgain = false;
        this.schedule(0);
      } else if (this.hasPending() && this.status === 'saving' && this.online) {
        this.schedule(450);
      }
    }
  }

  private onFail(e: unknown) {
    if (this.stopped) return;
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof NetworkError && !this.online) {
      this.setStatus('offline');
      return; // 'online' event restarts sending
    }
    // Couldn't reach the server, or it said no: keep the edits and try again, waiting longer each time.
    this.retryMs = Math.min(60_000, this.retryMs ? this.retryMs * 2 : 2_000);
    if (this.hasPending()) this.setStatus('error', msg);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.hasPending()) this.flush();
      else this.refresh();
    }, this.retryMs);
  }

  // ---------- keeping a copy on this device ----------
  private persist() {
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 60);
  }

  /** Writes the waiting edits and the open save's copy to this device right now. */
  persistNow() {
    clearTimeout(this.persistTimer);
    const state: Persisted = {
      saves: [...this.saves.values()],
      openId: this.openId,
      outSaves: [...this.outSaves.values()],
      outRecs: [...this.outRecs].map(([id, m]) => [id, [...m.values()]]),
      purgeRecs: [...this.purgeRecs].map(([id, s]) => [id, [...s]]),
      purgeSaves: [...this.purgeSaves],
      drafts: [...this.drafts.values()],
      draftOut: [...this.draftOut],
    };
    kvSet(`${this.prefix}state`, state);
    if (this.cacheTimer) this.writeCache();
  }

  private cacheTimer: ReturnType<typeof setTimeout> | undefined;
  private cacheFor: string | null = null;
  private cacheRecords(saveId: string) {
    if (saveId !== this.openId) return;
    this.cacheFor = saveId;
    clearTimeout(this.cacheTimer);
    this.cacheTimer = setTimeout(() => this.writeCache(), 300);
  }
  private writeCache() {
    clearTimeout(this.cacheTimer);
    this.cacheTimer = undefined;
    if (this.cacheFor && this.cacheFor === this.openId) kvSet(`${this.prefix}recs:${this.cacheFor}`, [...this.records.values()]);
    this.cacheFor = null;
  }
}
