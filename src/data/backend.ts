// Two places a save can live: the player's account (Supabase, syncs across devices)
// or this browser only (guest mode, for trying SimDesk without an account).
// The rest of the app doesn't care which.

import { del, get, set } from 'idb-keyval';
import { supabase, MEDIA_BUCKET } from '../lib/supabase';
import { blobToDataUrl, shrinkImage } from '../lib/images';
import { uid } from '../lib/ids';
import type { CustomTrait, RecordKind, Save } from '../lib/types';

export interface StoredRecord {
  id: string;
  kind: RecordKind;
  data: unknown;
}

export interface Backend {
  mode: 'cloud' | 'local';
  listSaves(): Promise<Save[]>;
  putSave(save: Save): Promise<void>;
  deleteSave(id: string): Promise<void>;
  loadRecords(saveId: string): Promise<StoredRecord[]>;
  putRecords(saveId: string, recs: StoredRecord[]): Promise<void>;
  deleteRecords(saveId: string, ids: string[]): Promise<void>;
  listCustomTraits(): Promise<CustomTrait[]>;
  putCustomTraits(t: CustomTrait[]): Promise<void>;
  deleteCustomTrait(id: string): Promise<void>;
  uploadImage(file: Blob, opts?: { maxSide?: number }): Promise<string>;
}

// ---------------- Cloud ----------------

export function cloudBackend(userId: string): Backend {
  const sb = supabase!;
  const check = <T extends { error: unknown }>(r: T) => {
    if (r.error) throw r.error;
    return r;
  };
  return {
    mode: 'cloud',
    async listSaves() {
      const { data } = check(await sb.from('sd_saves').select('id,data').order('created_at'));
      return (data ?? []).map((r) => ({ ...(r.data as Save), id: r.id }));
    },
    async putSave(save) {
      check(await sb.from('sd_saves').upsert({ id: save.id, user_id: userId, data: save, updated_at: new Date().toISOString() }));
    },
    async deleteSave(id) {
      check(await sb.from('sd_saves').delete().eq('id', id));
    },
    async loadRecords(saveId) {
      const out: StoredRecord[] = [];
      // page through in case a save gets very large
      for (let from = 0; ; from += 1000) {
        const { data } = check(
          await sb.from('sd_records').select('id,kind,data').eq('save_id', saveId).range(from, from + 999),
        );
        out.push(...((data ?? []) as StoredRecord[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async putRecords(saveId, recs) {
      if (!recs.length) return;
      const now = new Date().toISOString();
      check(
        await sb
          .from('sd_records')
          .upsert(recs.map((r) => ({ id: r.id, save_id: saveId, user_id: userId, kind: r.kind, data: r.data, updated_at: now }))),
      );
    },
    async deleteRecords(_saveId, ids) {
      if (!ids.length) return;
      check(await sb.from('sd_records').delete().in('id', ids));
    },
    async listCustomTraits() {
      const { data } = check(await sb.from('sd_custom_traits').select('id,data'));
      return (data ?? []).map((r) => ({ ...(r.data as CustomTrait), id: r.id }));
    },
    async putCustomTraits(t) {
      if (!t.length) return;
      check(await sb.from('sd_custom_traits').upsert(t.map((x) => ({ id: x.id, user_id: userId, data: x }))));
    },
    async deleteCustomTrait(id) {
      check(await sb.from('sd_custom_traits').delete().eq('id', id));
    },
    async uploadImage(file, opts) {
      const small = await shrinkImage(file, opts?.maxSide);
      const ext = small.type === 'image/webp' ? 'webp' : small.type === 'image/png' ? 'png' : 'jpg';
      const path = `${userId}/${uid()}.${ext}`;
      check(await sb.storage.from(MEDIA_BUCKET).upload(path, small, { contentType: small.type, cacheControl: '31536000' }));
      return sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}

// ---------------- This browser only ----------------

export function localBackend(): Backend {
  const SAVES = 'sd:saves';
  const recKey = (id: string) => `sd:records:${id}`;
  const TRAITS = 'sd:traits';
  return {
    mode: 'local',
    async listSaves() {
      return ((await get(SAVES)) as Save[] | undefined) ?? [];
    },
    async putSave(save) {
      const all = ((await get(SAVES)) as Save[] | undefined) ?? [];
      const i = all.findIndex((s) => s.id === save.id);
      if (i >= 0) all[i] = save;
      else all.push(save);
      await set(SAVES, all);
    },
    async deleteSave(id) {
      const all = ((await get(SAVES)) as Save[] | undefined) ?? [];
      await set(SAVES, all.filter((s) => s.id !== id));
      await del(recKey(id));
    },
    async loadRecords(saveId) {
      const m = ((await get(recKey(saveId))) as Record<string, StoredRecord> | undefined) ?? {};
      return Object.values(m);
    },
    async putRecords(saveId, recs) {
      const m = ((await get(recKey(saveId))) as Record<string, StoredRecord> | undefined) ?? {};
      for (const r of recs) m[r.id] = r;
      await set(recKey(saveId), m);
    },
    async deleteRecords(saveId, ids) {
      const m = ((await get(recKey(saveId))) as Record<string, StoredRecord> | undefined) ?? {};
      for (const id of ids) delete m[id];
      await set(recKey(saveId), m);
    },
    async listCustomTraits() {
      return ((await get(TRAITS)) as CustomTrait[] | undefined) ?? [];
    },
    async putCustomTraits(t) {
      const all = ((await get(TRAITS)) as CustomTrait[] | undefined) ?? [];
      for (const x of t) {
        const i = all.findIndex((y) => y.id === x.id);
        if (i >= 0) all[i] = x;
        else all.push(x);
      }
      await set(TRAITS, all);
    },
    async deleteCustomTrait(id) {
      const all = ((await get(TRAITS)) as CustomTrait[] | undefined) ?? [];
      await set(TRAITS, all.filter((x) => x.id !== id));
    },
    async uploadImage(file, opts) {
      return blobToDataUrl(await shrinkImage(file, Math.min(opts?.maxSide ?? 1280, 900), 0.78));
    },
  };
}
