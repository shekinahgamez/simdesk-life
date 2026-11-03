-- SimDesk v2: accounts, saves and records.
-- Replaces the empty v1 tables (sd_profiles, sd_saves, sd_records, sd_custom_traits).
-- The sd-media storage bucket is left alone until photos are built.

drop table if exists public.sd_records cascade;
drop table if exists public.sd_custom_traits cascade;
drop table if exists public.sd_saves cascade;
drop table if exists public.sd_profiles cascade;

-- ---------- accounts ----------
-- Usernames: letters, numbers, periods, underscores, 3-30 characters. Unique ignoring capitals.
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9._]{3,30}$'),
  plan       text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Every username change, so the "twice in 14 days" rule can be checked.
create table public.username_changes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  changed_at timestamptz not null default now()
);
create index username_changes_user on public.username_changes (user_id, changed_at);

alter table public.profiles enable row level security;
alter table public.username_changes enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "username_changes: read own" on public.username_changes for select to authenticated using (user_id = (select auth.uid()));

-- Players may only change their username themselves. Plan is changed by the server only.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
revoke all on public.username_changes from anon, authenticated;
grant select on public.username_changes to authenticated;

-- Username change rule: at most 2 changes in any 14 days.
create or replace function public.before_username_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recent int;
begin
  if new.username is distinct from old.username then
    select count(*) into recent from public.username_changes
      where user_id = old.user_id and changed_at > now() - interval '14 days';
    if recent >= 2 then
      raise exception 'username_change_limit' using errcode = 'P0001';
    end if;
    insert into public.username_changes (user_id) values (old.user_id);
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger profiles_username_change before update of username on public.profiles
  for each row execute function public.before_username_change();

-- A new account gets its profile straight away, using the username typed at sign-up.
-- If that username was taken a moment ago, sign-up fails instead of creating an account without one.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (user_id, username) values (new.id, new.raw_user_meta_data ->> 'username');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is this username free? Used on the sign-up form while typing. Says nothing else about anyone.
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select name ~ '^[A-Za-z0-9._]{3,30}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- For accounts made before usernames existed: pick one after logging in.
create or replace function public.claim_username(name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  insert into public.profiles (user_id, username) values ((select auth.uid()), name);
end $$;
revoke all on function public.claim_username(text) from public, anon;
grant execute on function public.claim_username(text) to authenticated;

-- ---------- saves ----------
create table public.saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saves_user on public.saves (user_id);
alter table public.saves enable row level security;
create policy "saves: own" on public.saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- records (Sims, households, lots, ...) ----------
-- Keyed by save + record id, and the id is text, so built-in worlds and lots
-- (ids like "willow-creek--sylvan-glade") save fine and two saves never collide.
create table public.records (
  save_id    uuid not null references public.saves (id) on delete cascade,
  id         text not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (save_id, id)
);
create index records_user on public.records (user_id);
create index records_save_kind on public.records (save_id, kind);
alter table public.records enable row level security;
create policy "records: own" on public.records for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.saves s where s.id = save_id and s.user_id = (select auth.uid()))
  );
