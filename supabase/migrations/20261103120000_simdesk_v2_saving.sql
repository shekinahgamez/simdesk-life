-- SimDesk v2, step 5: saving, sync, trash and drafts.
-- Newest edit wins (per item), Trash keeps things 7 days, drafts last 14 days.

-- Edit time (from the device, never later than the server's clock) decides which edit wins.
alter table public.saves add column if not exists edited_at timestamptz not null default now();
alter table public.saves add column if not exists deleted_at timestamptz;
alter table public.records add column if not exists edited_at timestamptz not null default now();
alter table public.records add column if not exists deleted_at timestamptz;

alter table public.records add constraint records_id_len check (char_length(id) between 1 and 80);
alter table public.records add constraint records_kind_ok check (kind ~ '^[a-z_]{1,40}$');
alter table public.records add constraint records_data_size check (octet_length(data::text) <= 200000);
alter table public.saves add constraint saves_data_size check (octet_length(data::text) <= 200000);

create index if not exists records_trash on public.records (deleted_at) where deleted_at is not null;
create index if not exists saves_trash on public.saves (deleted_at) where deleted_at is not null;

-- Drafts: what someone typed in a form but didn't save yet. One per form (key).
create table if not exists public.drafts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  save_id uuid references public.saves (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists drafts_save on public.drafts (save_id);
create index if not exists drafts_age on public.drafts (updated_at);
alter table public.drafts enable row level security;
create policy "drafts: own" on public.drafts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (save_id is null or exists (
    select 1 from public.saves s where s.id = drafts.save_id and s.user_id = (select auth.uid()))));

-- Send a batch of edits. Each one only lands if it's newer than what's already there.
-- Returns what the server now holds for those items, so the device can catch up.
create or replace function public.push_records(p_save uuid, p_items jsonb)
returns setof public.records
language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'bad_batch';
  end if;
  insert into public.records as r (save_id, id, user_id, kind, data, edited_at, deleted_at, updated_at)
  select p_save, i->>'id', auth.uid(), i->>'kind', coalesce(i->'data', '{}'::jsonb),
         least((i->>'edited_at')::timestamptz, now()),
         least((i->>'deleted_at')::timestamptz, now()),
         now()
  from jsonb_array_elements(p_items) i
  on conflict (save_id, id) do update
    set kind = excluded.kind, data = excluded.data, edited_at = excluded.edited_at,
        deleted_at = excluded.deleted_at, updated_at = now()
    where r.edited_at <= excluded.edited_at;
  return query
    select * from public.records r
    where r.save_id = p_save and r.id in (select i->>'id' from jsonb_array_elements(p_items) i);
end $$;
revoke all on function public.push_records(uuid, jsonb) from public, anon;
grant execute on function public.push_records(uuid, jsonb) to authenticated;

-- Same idea for a save's own settings (also used to make a new save, even while offline).
create or replace function public.push_save(p_id uuid, p_data jsonb, p_edited_at timestamptz, p_deleted_at timestamptz)
returns public.saves
language plpgsql security invoker set search_path = '' as $$
declare result public.saves;
begin
  insert into public.saves as s (id, user_id, data, edited_at, deleted_at, updated_at)
  values (p_id, auth.uid(), coalesce(p_data, '{}'::jsonb), least(p_edited_at, now()), least(p_deleted_at, now()), now())
  on conflict (id) do update
    set data = excluded.data, edited_at = excluded.edited_at, deleted_at = excluded.deleted_at, updated_at = now()
    where s.edited_at <= excluded.edited_at;
  select * into result from public.saves where id = p_id;
  return result;
end $$;
revoke all on function public.push_save(uuid, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.push_save(uuid, jsonb, timestamptz, timestamptz) to authenticated;

-- Nightly cleanup: Trash older than 7 days and drafts older than 14 days are deleted for good.
-- (Photos get removed here too once photo uploads exist.)
create or replace function public.simdesk_cleanup()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.saves where deleted_at < now() - interval '7 days';
  delete from public.records where deleted_at < now() - interval '7 days';
  delete from public.drafts where updated_at < now() - interval '14 days';
end $$;
revoke all on function public.simdesk_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('simdesk-cleanup', '17 4 * * *', 'select public.simdesk_cleanup()');

-- Live updates between devices.
alter publication supabase_realtime add table public.records, public.saves;
