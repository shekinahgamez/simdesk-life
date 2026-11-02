-- SimDesk v1 (applied to the "simdesk" Supabase project, pyszlcaaotkituvvpvvw, on Nov 2, 2026).
-- Kept here so the schema lives with the code.

create table if not exists public.sd_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',            -- room for the paid tier later
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sd_saves (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sd_saves_user_idx on public.sd_saves(user_id);

-- Every player-made thing in a save. `kind` = sim | household | relationship | world | lot | holiday | club.
-- New modules add kinds, not tables.
create table if not exists public.sd_records (
  id uuid primary key,
  save_id uuid not null references public.sd_saves(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists sd_records_save_idx on public.sd_records(save_id);
create index if not exists sd_records_user_idx on public.sd_records(user_id);

create table if not exists public.sd_custom_traits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists sd_custom_traits_user_idx on public.sd_custom_traits(user_id);

alter table public.sd_profiles enable row level security;
alter table public.sd_saves enable row level security;
alter table public.sd_records enable row level security;
alter table public.sd_custom_traits enable row level security;

create policy "sd_profiles own" on public.sd_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sd_saves own" on public.sd_saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sd_records own" on public.sd_records for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sd_custom_traits own" on public.sd_custom_traits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sd-media', 'sd-media', true, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "sd-media insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'sd-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "sd-media update own" on storage.objects for update to authenticated
  using (bucket_id = 'sd-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "sd-media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'sd-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
