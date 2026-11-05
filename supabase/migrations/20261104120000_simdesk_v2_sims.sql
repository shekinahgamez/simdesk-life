-- Phase 3 (Sims): account-wide things (custom traits, display choices) and photos.

-- ---------- one record per account: custom traits and display choices ----------
create table if not exists public.account_docs (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  edited_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.account_docs enable row level security;
create policy "account_docs: own" on public.account_docs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Newest edit wins, same as records.
create or replace function public.push_account(p_data jsonb, p_edited_at timestamptz)
returns public.account_docs
language plpgsql security invoker set search_path = '' as $$
declare result public.account_docs;
begin
  insert into public.account_docs as a (user_id, data, edited_at, updated_at)
  values (auth.uid(), coalesce(p_data, '{}'::jsonb), least(p_edited_at, now()), now())
  on conflict (user_id) do update
    set data = excluded.data, edited_at = excluded.edited_at, updated_at = now()
    where a.edited_at <= excluded.edited_at;
  select * into result from public.account_docs where user_id = auth.uid();
  return result;
end $$;
revoke all on function public.push_account(jsonb, timestamptz) from public, anon;
grant execute on function public.push_account(jsonb, timestamptz) to authenticated;

-- ---------- photos ----------
-- One row per photo (its full size and small copy live in storage under the same id).
-- The row is what counts toward the plan's photo limit.
create table if not exists public.photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  save_id uuid references public.saves(id) on delete set null,
  bytes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;
create policy "photos: own" on public.photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists photos_user on public.photos (user_id);
create index if not exists photos_save on public.photos (save_id);

-- Photo limits per plan. Free: 100. Paid plans get added here later.
create or replace function public.photo_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 100 else 100 end
$$;

create or replace function public.before_photo_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare used int; lim int;
begin
  select count(*) into used from public.photos where user_id = new.user_id;
  select public.photo_limit(coalesce((select plan from public.profiles where user_id = new.user_id), 'free')) into lim;
  if used >= lim then
    raise exception 'photo_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.before_photo_insert() from public, anon, authenticated;
drop trigger if exists photos_limit on public.photos;
create trigger photos_limit before insert on public.photos for each row execute function public.before_photo_insert();

-- How many photos this account has, and its limit.
create or replace function public.photo_usage() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'used', (select count(*) from public.photos where user_id = auth.uid()),
    'limit', public.photo_limit(coalesce((select plan from public.profiles where user_id = auth.uid()), 'free')))
$$;
revoke all on function public.photo_usage() from public, anon;
grant execute on function public.photo_usage() to authenticated;

-- Private storage: only the owner can read or change their photos (shown with short-lived links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "photos bucket: read own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos bucket: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos bucket: update own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos bucket: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
