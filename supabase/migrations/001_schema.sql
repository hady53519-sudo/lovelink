-- LoveLink — 001: tables, constraints, indexes, triggers
-- Run migrations 001 → 004 in order (SQL Editor or `supabase db push`).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Unpredictable 14-character public slug (≈ 81 bits). Ambiguous characters
-- (0 O o 1 l I) are excluded. Never sequential, never derived from row order.
create or replace function public.gen_slug()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(14);
  result text := '';
  i int;
begin
  for i in 0..13 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 56) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (one row per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- surprises
-- ---------------------------------------------------------------------------
create table if not exists public.surprises (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  slug               text not null unique default public.gen_slug()
                       check (char_length(slug) between 10 and 64),
  status             text not null default 'draft' check (status in ('draft', 'published')),
  lang               text not null default 'en' check (lang in ('en', 'ar')),

  -- content
  name_a             text not null default '' check (char_length(name_a) <= 60),
  name_b             text not null default '' check (char_length(name_b) <= 60),
  title              text not null default '' check (char_length(title) <= 120),
  message            text not null default '' check (char_length(message) <= 5000),
  theme              text not null default 'elegant'
                       check (theme in ('cute', 'elegant', 'cinematic', 'minimal')),
  song_url           text check (
                       song_url is null or (
                         char_length(song_url) <= 500 and
                         song_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|spotify\.com)/.+'
                       )),
  video_url          text check (
                       video_url is null or (
                         char_length(video_url) <= 500 and
                         video_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|vimeo\.com)/.+'
                       )),
  special_date       date,
  special_date_label text not null default '' check (char_length(special_date_label) <= 80),
  cards              jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(cards) = 'array' and jsonb_array_length(cards) <= 6),
  timeline           jsonb not null default '[]'::jsonb
                       check (jsonb_typeof(timeline) = 'array' and jsonb_array_length(timeline) <= 20),
  games              jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(games) = 'object' and char_length(games::text) <= 4000),
  final_button_label text not null default '' check (char_length(final_button_label) <= 40),
  final_message      text not null default '' check (char_length(final_message) <= 2000),

  -- Only ever changed by public.set_surprise_password() (see trigger below).
  is_protected       boolean not null default false,

  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists surprises_owner_updated_idx
  on public.surprises (owner_id, updated_at desc);
create index if not exists surprises_published_idx
  on public.surprises (slug) where status = 'published';

-- Password hashes live in their own table with RLS enabled and NO policies,
-- so no API role can ever read them. Only SECURITY DEFINER functions touch it.
create table if not exists public.surprise_secrets (
  surprise_id   uuid primary key references public.surprises (id) on delete cascade,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

-- Failed/successful password attempts, used for brute-force throttling.
create table if not exists public.password_attempts (
  id           bigint generated always as identity primary key,
  slug         text not null,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists password_attempts_slug_time_idx
  on public.password_attempts (slug, attempted_at desc);

-- ---------------------------------------------------------------------------
-- surprise_photos (metadata only; files live in Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.surprise_photos (
  id           uuid primary key default gen_random_uuid(),
  surprise_id  uuid not null references public.surprises (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  kind         text not null default 'gallery' check (kind in ('gallery', 'background')),
  caption      text not null default '' check (char_length(caption) <= 200),
  position     integer not null default 0 check (position between 0 and 100),
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at   timestamptz not null default now()
);

create index if not exists surprise_photos_surprise_idx
  on public.surprise_photos (surprise_id, position);
create index if not exists surprise_photos_owner_idx
  on public.surprise_photos (owner_id);

-- ---------------------------------------------------------------------------
-- Triggers: server-side validation & guards
-- ---------------------------------------------------------------------------
create trigger surprises_touch before update on public.surprises
  for each row execute function public.touch_updated_at();

create or replace function public.surprises_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item jsonb;
  total int;
begin
  -- Quota: at most 30 surprises per account (basic abuse control).
  if tg_op = 'INSERT' then
    select count(*) into total from public.surprises where owner_id = new.owner_id;
    if total >= 30 then
      raise exception 'surprise_limit_reached' using errcode = 'check_violation';
    end if;
    new.is_protected := false;
  end if;

  -- Protection flag can only be flipped by set_surprise_password().
  if tg_op = 'UPDATE'
     and new.is_protected is distinct from old.is_protected
     and coalesce(current_setting('app.pw_rpc', true), '') <> 'on' then
    raise exception 'protection_flag_is_managed_by_server' using errcode = 'check_violation';
  end if;

  -- Normalise empty media strings to NULL.
  if new.song_url = '' then new.song_url := null; end if;
  if new.video_url = '' then new.video_url := null; end if;

  -- Validate JSON element shapes and lengths.
  for item in select * from jsonb_array_elements(new.cards) loop
    if jsonb_typeof(item) <> 'object'
       or char_length(coalesce(item ->> 'front', '')) > 200
       or char_length(coalesce(item ->> 'back', '')) > 600 then
      raise exception 'invalid_cards' using errcode = 'check_violation';
    end if;
  end loop;
  for item in select * from jsonb_array_elements(new.timeline) loop
    if jsonb_typeof(item) <> 'object'
       or char_length(coalesce(item ->> 'date', '')) > 40
       or char_length(coalesce(item ->> 'title', '')) > 100
       or char_length(coalesce(item ->> 'text', '')) > 600 then
      raise exception 'invalid_timeline' using errcode = 'check_violation';
    end if;
  end loop;

  -- Mini-games: at most 8 coupons and 8 wheel slices.
  if (new.games #> '{coupons,items}') is not null
     and (jsonb_typeof(new.games #> '{coupons,items}') <> 'array'
          or jsonb_array_length(new.games #> '{coupons,items}') > 8) then
    raise exception 'invalid_games' using errcode = 'check_violation';
  end if;
  if (new.games #> '{wheel,items}') is not null
     and (jsonb_typeof(new.games #> '{wheel,items}') <> 'array'
          or jsonb_array_length(new.games #> '{wheel,items}') > 8) then
    raise exception 'invalid_games' using errcode = 'check_violation';
  end if;

  -- Publishing requires the essentials.
  if new.status = 'published' then
    if btrim(new.name_a) = '' or btrim(new.name_b) = ''
       or btrim(new.title) = '' or btrim(new.message) = '' then
      raise exception 'missing_required_fields' using errcode = 'check_violation';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger surprises_guard_trg
  before insert or update on public.surprises
  for each row execute function public.surprises_guard();

create or replace function public.photos_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.surprises;
  n int;
begin
  select * into s from public.surprises where id = new.surprise_id;
  if not found or s.owner_id <> new.owner_id then
    raise exception 'photo_owner_mismatch' using errcode = 'check_violation';
  end if;

  -- Path must be <owner_id>/<surprise_id>/<file>
  if new.storage_path not like (new.owner_id::text || '/' || new.surprise_id::text || '/%') then
    raise exception 'invalid_storage_path' using errcode = 'check_violation';
  end if;

  select count(*) into n from public.surprise_photos
   where surprise_id = new.surprise_id and kind = new.kind;
  if new.kind = 'gallery' and n >= 12 then
    raise exception 'gallery_limit_reached' using errcode = 'check_violation';
  elsif new.kind = 'background' and n >= 1 then
    raise exception 'background_limit_reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger photos_guard_trg
  before insert on public.surprise_photos
  for each row execute function public.photos_guard();
