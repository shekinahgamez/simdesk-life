import { GoneError, NetworkError, type Backend, type DraftRow, type Rec, type RemoteEvent, type SaveRow } from './types';

/**
 * A pretend account, kept in this browser, for the style check test page (the preview can't reach
 * Supabase). It follows the same rules as the real database: newest edit wins, and it can pretend
 * to be offline or to be another device.
 */
export class MemoryBackend implements Backend {
  delay = 250;
  private off = false;
  /** Remembered across reloads, so "reload while offline" can be tested. */
  get offline() { return this.off; }
  set offline(v: boolean) {
    this.off = v;
    try { if (v) localStorage.setItem(`${this.key}:offline`, '1'); else localStorage.removeItem(`${this.key}:offline`); } catch { /* ignore */ }
  }
  private saves = new Map<string, SaveRow>();
  private recs = new Map<string, Map<string, Rec>>();
  private drafts = new Map<string, DraftRow>();
  private listeners = new Set<(e: RemoteEvent) => void>();
  private reconnects = new Set<() => void>();
  private key: string;

  constructor(key: string) {
    this.key = key;
    try { this.off = localStorage.getItem(`${key}:offline`) === '1'; } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw) as { saves: SaveRow[]; recs: [string, Rec[]][]; drafts: DraftRow[] };
        this.saves = new Map(d.saves.map((s) => [s.id, s]));
        this.recs = new Map(d.recs.map(([id, rs]) => [id, new Map(rs.map((r) => [r.id, r]))]));
        this.drafts = new Map(d.drafts.map((x) => [x.key, x]));
      }
    } catch { /* start empty */ }
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify({
        saves: [...this.saves.values()],
        recs: [...this.recs].map(([id, m]) => [id, [...m.values()]]),
        drafts: [...this.drafts.values()],
      }));
    } catch { /* ignore */ }
  }

  reset() {
    this.saves.clear();
    this.recs.clear();
    this.drafts.clear();
    this.offline = false;
    try { localStorage.removeItem(this.key); } catch { /* ignore */ }
  }

  private async wait() {
    await new Promise((r) => setTimeout(r, this.delay));
    if (this.offline) throw new NetworkError('Failed to fetch');
  }
  private clamp(iso: string | null) {
    if (!iso) return null;
    return new Date(Math.min(Date.parse(iso), Date.now())).toISOString();
  }

  async listSaves() { await this.wait(); return [...this.saves.values()]; }
  async pushSave(s: SaveRow) {
    await this.wait();
    const cur = this.saves.get(s.id);
    const row = { ...s, edited_at: this.clamp(s.edited_at)!, deleted_at: this.clamp(s.deleted_at), created_at: cur?.created_at ?? s.created_at ?? new Date().toISOString() };
    if (!cur || Date.parse(cur.edited_at) <= Date.parse(row.edited_at)) this.saves.set(s.id, row);
    this.save();
    return this.saves.get(s.id)!;
  }
  async purgeSave(id: string) {
    await this.wait();
    this.saves.delete(id);
    this.recs.delete(id);
    for (const [k, d] of [...this.drafts]) if (d.save_id === id) this.drafts.delete(k);
    this.save();
  }
  async loadRecords(saveId: string) { await this.wait(); return [...(this.recs.get(saveId)?.values() ?? [])]; }
  async pushRecords(saveId: string, items: Rec[]) {
    await this.wait();
    if (!this.saves.has(saveId)) throw new GoneError('new row violates row-level security policy');
    const m = this.recs.get(saveId) ?? new Map<string, Rec>();
    for (const it of items) {
      const row = { ...it, edited_at: this.clamp(it.edited_at)!, deleted_at: this.clamp(it.deleted_at) };
      const cur = m.get(it.id);
      if (!cur || Date.parse(cur.edited_at) <= Date.parse(row.edited_at)) m.set(it.id, row);
    }
    this.recs.set(saveId, m);
    this.save();
    return items.map((i) => m.get(i.id)!).filter(Boolean);
  }
  async purgeRecords(saveId: string, ids: string[]) {
    await this.wait();
    for (const id of ids) this.recs.get(saveId)?.delete(id);
    this.save();
  }
  async listDrafts() { await this.wait(); return [...this.drafts.values()]; }
  async putDraft(d: DraftRow) {
    await this.wait();
    if (d.save_id && !this.saves.has(d.save_id)) throw new GoneError('row-level security');
    this.drafts.set(d.key, d);
    this.save();
  }
  async deleteDraft(key: string) { await this.wait(); this.drafts.delete(key); this.save(); }

  subscribe(onEvent: (e: RemoteEvent) => void, onReconnect: () => void) {
    this.listeners.add(onEvent);
    this.reconnects.add(onReconnect);
    return () => { this.listeners.delete(onEvent); this.reconnects.delete(onReconnect); };
  }

  /** Pretend another device edited a thing (it arrives live, like the real thing). */
  otherDeviceEdit(saveId: string, id: string, change: (data: Record<string, unknown>) => Record<string, unknown>) {
    const m = this.recs.get(saveId);
    const cur = m?.get(id);
    if (!m || !cur) return false;
    const row: Rec = { ...cur, data: change(cur.data), edited_at: new Date().toISOString() };
    m.set(id, row);
    this.save();
    if (!this.offline) for (const fn of this.listeners) fn({ type: 'record', saveId, rec: row });
    return true;
  }
  /** Back online: real live updates reconnect and re-read; do the same. */
  reconnected() { for (const fn of this.reconnects) fn(); }
}
