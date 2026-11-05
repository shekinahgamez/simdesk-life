import { createContext, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { draftDaysLeft, type SyncStore } from './store';
import { DRAFT_WARN_DAYS, type Rec } from './types';

const Ctx = createContext<SyncStore | null>(null);

export function SyncProvider({ store, children }: { store: SyncStore; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): SyncStore {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore needs a SyncProvider');
  return s;
}

/** Re-draws whenever anything in the store changes. Returns the change counter. */
export function useStoreVersion(): number {
  const s = useStore();
  return useSyncExternalStore(s.subscribe, s.getVersion);
}

export function useSyncStatus() {
  const s = useStore();
  useStoreVersion();
  return { status: s.status, error: s.error, pending: s.pendingCount() };
}

export function useSaves() {
  const s = useStore();
  const v = useStoreVersion();
  return useMemo(() => ({ active: s.activeSaves(), trashed: s.trashedSaves() }), [s, v]);
}

/** Things of one kind in the open save (not in Trash). */
export function useRecords(kind: string): Rec[] {
  const s = useStore();
  const v = useStoreVersion();
  return useMemo(() => s.list(kind), [s, v, kind]);
}

export function useTrash(): Rec[] {
  const s = useStore();
  const v = useStoreVersion();
  return useMemo(() => s.trash(), [s, v]);
}

/**
 * For a form editing an existing thing: notices when another device changes (or trashes) it
 * while the form is open. `keepMine` hides the notice (saving then overwrites theirs).
 * `useTheirs` hides it and returns their version so the form can reload from it.
 */
export function useEditGuard(id: string | null) {
  const s = useStore();
  useStoreVersion();
  const hits = id ? s.remoteHits.get(id) ?? 0 : 0;
  const base = useRef(hits);
  const [, redraw] = useState(0);
  const theirs = id && hits !== base.current ? s.records.get(id) ?? null : null;
  return {
    theirs,
    keepMine() { base.current = hits; redraw((n) => n + 1); },
    useTheirs(): Rec | null { base.current = hits; redraw((n) => n + 1); return theirs; },
  };
}

/** A form's draft: what was typed but not saved yet. Expires after 14 days. */
export function useDraft<T extends Record<string, unknown>>(key: string) {
  const s = useStore();
  useStoreVersion();
  const d = s.getDraft(key);
  const daysLeft = d ? draftDaysLeft(d.updated_at) : null;
  return {
    draft: d ? (d.data as T) : null,
    savedAt: d ? new Date(d.updated_at) : null,
    daysLeft,
    expiringSoon: daysLeft !== null && daysLeft <= DRAFT_WARN_DAYS,
    save: (data: T) => s.setDraft(key, data),
    clear: () => s.clearDraft(key),
  };
}

/** Account-wide things (custom traits, display choices). */
export function useAccount() {
  const s = useStore();
  const v = useStoreVersion();
  return useMemo(() => ({ data: s.accountData(), update: (fn: (d: Record<string, unknown>) => Record<string, unknown>) => s.updateAccount(fn) }), [s, v]);
}
