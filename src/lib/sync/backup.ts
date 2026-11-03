import { APP } from '../../config/app';
import type { SyncStore } from './store';

/** Builds a backup file of one save (everything not in Trash) and downloads it. */
export async function downloadBackup(store: SyncStore, saveId: string): Promise<boolean> {
  const save = store.saves.get(saveId);
  if (!save) return false;
  const recs = (await store.allRecords(saveId)).filter((r) => !r.deleted_at);
  const file = {
    app: APP.name,
    format: 1,
    exported_at: new Date().toISOString(),
    save: { id: save.id, created_at: save.created_at ?? null, data: save.data },
    records: recs.map((r) => ({ id: r.id, kind: r.kind, data: r.data, edited_at: r.edited_at })),
  };
  const slug = (save.data.name || 'save').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save';
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP.wordmark}-backup-${slug}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
