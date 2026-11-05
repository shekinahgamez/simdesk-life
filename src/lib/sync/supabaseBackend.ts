import { supabase } from '../supabase';
import { GoneError, NetworkError, type AccountDoc, type Backend, type DraftRow, type Rec, type SaveRow } from './types';

const NET = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? 'Unknown error';
  if (!navigator.onLine || NET.test(msg)) throw new NetworkError(msg);
  // 42501 = row-level security: the save isn't ours any more (it was deleted for good).
  if (error?.code === '42501' || /row-level security/i.test(msg)) throw new GoneError(msg);
  throw new Error(msg);
}

const REC_COLS = 'id,kind,data,edited_at,deleted_at';
const SAVE_COLS = 'id,data,edited_at,deleted_at,created_at';
const pickRec = (r: Rec): Rec => ({ id: r.id, kind: r.kind, data: r.data, edited_at: r.edited_at, deleted_at: r.deleted_at });
const pickSave = (s: SaveRow): SaveRow => ({ id: s.id, data: s.data, edited_at: s.edited_at, deleted_at: s.deleted_at, created_at: s.created_at });

export const supabaseBackend: Backend = {
  async listSaves() {
    const { data, error } = await supabase.from('saves').select(SAVE_COLS);
    if (error) fail(error);
    return (data ?? []) as SaveRow[];
  },
  async pushSave(s) {
    const { data, error } = await supabase.rpc('push_save', {
      p_id: s.id, p_data: s.data, p_edited_at: s.edited_at, p_deleted_at: s.deleted_at,
    });
    if (error) fail(error);
    return pickSave(data as SaveRow);
  },
  async purgeSave(id) {
    const { error } = await supabase.from('saves').delete().eq('id', id);
    if (error) fail(error);
  },
  async loadRecords(saveId) {
    // Supabase sends at most 1000 rows at a time, so read in pages.
    const out: Rec[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('records').select(REC_COLS).eq('save_id', saveId)
        .order('id').range(from, from + 999);
      if (error) fail(error);
      out.push(...((data ?? []) as Rec[]));
      if (!data || data.length < 1000) return out;
    }
  },
  async pushRecords(saveId, items) {
    const { data, error } = await supabase.rpc('push_records', { p_save: saveId, p_items: items });
    if (error) fail(error);
    return ((data ?? []) as Rec[]).map(pickRec);
  },
  async purgeRecords(saveId, ids) {
    const { error } = await supabase.from('records').delete().eq('save_id', saveId).in('id', ids);
    if (error) fail(error);
  },
  async listDrafts() {
    const { data, error } = await supabase.from('drafts').select('key,save_id,data,updated_at');
    if (error) fail(error);
    return (data ?? []) as DraftRow[];
  },
  async putDraft(d) {
    const { error } = await supabase.from('drafts').upsert(d, { onConflict: 'user_id,key' });
    if (error) fail(error);
  },
  async deleteDraft(key) {
    const { error } = await supabase.from('drafts').delete().eq('key', key);
    if (error) fail(error);
  },
  async loadAccount() {
    const { data, error } = await supabase.from('account_docs').select('data,edited_at').maybeSingle();
    if (error) fail(error);
    return (data as AccountDoc | null) ?? null;
  },
  async pushAccount(doc) {
    const { data, error } = await supabase.rpc('push_account', { p_data: doc.data, p_edited_at: doc.edited_at });
    if (error) fail(error);
    const row = data as AccountDoc;
    return { data: row.data, edited_at: row.edited_at };
  },
  subscribe(onEvent, onReconnect) {
    let joinedOnce = false;
    const ch = supabase
      .channel('simdesk-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (p) => {
        const row = p.new as (Rec & { save_id: string }) | undefined;
        if (row && row.id) onEvent({ type: 'record', saveId: row.save_id, rec: pickRec(row) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saves' }, (p) => {
        const row = p.new as SaveRow | undefined;
        if (row && row.id) onEvent({ type: 'save', save: pickSave(row) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_docs' }, (p) => {
        const row = p.new as AccountDoc | undefined;
        if (row && row.edited_at) onEvent({ type: 'account', doc: { data: row.data, edited_at: row.edited_at } });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // After a dropped connection, some live changes may have been missed: re-read.
          if (joinedOnce) onReconnect();
          joinedOnce = true;
        }
      });
    return () => { supabase.removeChannel(ch); };
  },
};
