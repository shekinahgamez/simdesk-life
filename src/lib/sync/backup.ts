import { APP } from '../../config/app';
import { photoIdsIn, type PhotoService } from '../photos';
import { saveData, type SaveData } from '../saves';
import { plural } from '../text';
import { newId, type SyncStore } from './store';
import type { Rec, SaveRow } from './types';

/** What a backup file holds. Format 1 had no photos; format 2 can carry them (as data: links). */
export type BackupFile = {
  app: string;
  format: 1 | 2;
  exported_at: string;
  save: { id: string; created_at: string | null; data: Record<string, unknown> };
  records: { id: string; kind: string; data: Record<string, unknown>; edited_at?: string }[];
  photos?: Record<string, { w: number; h: number; full: string }>;
};

/** Every photo a save uses: portraits, stage photos, covers, photo records. */
export function photosOf(saveDataRaw: Record<string, unknown>, recs: { data: Record<string, unknown> }[]): string[] {
  return [...new Set([...photoIdsIn(saveDataRaw), ...recs.flatMap((r) => photoIdsIn(r.data))])];
}

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result as string); f.onerror = rej; f.readAsDataURL(b); });

/** When this save was last backed up (kept on the save, so every device knows). */
export const lastBackupOf = (s: SaveRow): string | null => ((s.data as { backedUpAt?: unknown }).backedUpAt as string) ?? null;

/** Builds a backup file of one save (everything not in Trash) and downloads it. With `photos`, the photos go in too. */
export async function downloadBackup(store: SyncStore, saveId: string, photos: PhotoService | null = null): Promise<boolean> {
  const save = store.saves.get(saveId);
  if (!save) return false;
  const recs = (await store.allRecords(saveId)).filter((r) => !r.deleted_at);
  const file: BackupFile = {
    app: APP.name,
    format: photos ? 2 : 1,
    exported_at: new Date().toISOString(),
    save: { id: save.id, created_at: save.created_at ?? null, data: save.data },
    records: recs.map((r) => ({ id: r.id, kind: r.kind, data: r.data, edited_at: r.edited_at })),
  };
  if (photos) {
    file.photos = {};
    const sizes = new Map<string, { w: number; h: number }>();
    const note = (d: Record<string, unknown>) => { for (const v of Object.values(d)) if (v && typeof v === 'object') { const p = v as { id?: unknown; w?: unknown; h?: unknown }; if (typeof p.id === 'string' && typeof p.w === 'number') sizes.set(p.id, { w: p.w, h: p.h as number }); else note(v as Record<string, unknown>); } };
    note(save.data); for (const r of recs) note(r.data);
    for (const id of photosOf(save.data, recs)) {
      try {
        const blob = await (await fetch(await photos.url(id, 'full'))).blob();
        file.photos[id] = { ...(sizes.get(id) ?? { w: 0, h: 0 }), full: await toDataUrl(blob) };
      } catch { /* a photo that can't be fetched is left out; the rest still back up */ }
    }
  }
  const slug = (save.data.name || 'save').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save';
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP.wordmark}-backup-${slug}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  store.updateSave(saveId, { backedUpAt: file.exported_at } as Partial<SaveData>);
  return true;
}

/** Reads a backup file's text. Throws when it isn't one. */
export function readBackup(text: string): BackupFile {
  const f = JSON.parse(text) as Partial<BackupFile>;
  if (!f || f.app !== APP.name || (f.format !== 1 && f.format !== 2) || !f.save || typeof f.save.data !== 'object' || !Array.isArray(f.records)) throw new Error('not a backup');
  return f as BackupFile;
}

/** "53 Sims", "21 households"… for the restore preview. */
export function backupCounts(f: BackupFile): string[] {
  const n = (k: string) => f.records.filter((r) => r.kind === k).length;
  const out = [
    n('sim') && plural(n('sim'), 'Sim'), n('household') && plural(n('household'), 'household'), n('lot') && plural(n('lot'), 'lot'),
    n('club') && plural(n('club'), 'club'), (n('holiday') + n('event')) && plural(n('holiday') + n('event'), 'calendar item'),
  ].filter(Boolean) as string[];
  const p = Object.keys(f.photos ?? {}).length;
  out.push(p ? plural(p, 'photo') : 'No photos');
  return out;
}

/** Swaps every string that is exactly an old id for its new one, anywhere inside. */
function remap<T>(v: T, ids: Map<string, string>): T {
  if (typeof v === 'string') return (ids.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => remap(x, ids)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [ids.get(k) ?? k, remap(x, ids)])) as T;
  return v;
}

const fromDataUrl = async (u: string) => (await fetch(u)).blob();

/**
 * Brings a backup back as a new save (never over an existing one). Everything gets new ids so it can sit
 * next to the save it came from. Photos in the file are uploaded again; without them, photo links stay as they were.
 */
export async function restoreBackup(store: SyncStore, f: BackupFile, name: string, photos: PhotoService | null, prepare?: (b: Blob) => Promise<import('../photos').Prepared>): Promise<string> {
  const ids = new Map<string, string>();
  for (const r of f.records) ids.set(r.id, newId());
  if (photos && f.photos) {
    const prep = prepare ?? (await import('../photos')).preparePhoto;
    for (const [old, p] of Object.entries(f.photos)) {
      try { ids.set(old, await photos.upload(await prep(await fromDataUrl(p.full)), null)); } catch { /* keep the old link */ }
    }
  }
  const t = new Date().toISOString();
  const data = remap({ ...f.save.data }, ids) as Record<string, unknown>;
  delete data.backedUpAt;
  const clean = saveData({ data } as unknown as SaveRow);
  const recs: Rec[] = f.records.map((r) => ({ id: ids.get(r.id)!, kind: r.kind, data: remap(r.data, ids), edited_at: t, deleted_at: null }));
  return store.importSave({ ...(data as SaveData), ...clean, name: name || clean.name }, recs);
}
