-- LoveLink: ALL-IN-ONE upgrade for projects that already ran the OLD 001_init.sql.
-- Paste this whole file into Supabase SQL Editor and press Run, ONCE. If anything fails, nothing is applied (single transaction).
begin;

-- ===== step1_before_new_migrations.sql =====
-- LoveLink — UPGRADE from the first version (the one created with 001_init.sql)
-- STEP 1 of 3. Run this FIRST, once, in the Supabase SQL Editor.
--
-- Order:  step1 (this file)  ->  migrations 001, 002, 003, 004  ->  step2_import_old_data.sql
--
-- Nothing is deleted: your old tables are only RENAMED to *_legacy (data stays),
-- so the new schema can be created next to them.

-- 1. Rename old tables and the index names that would clash with the new schema.
alter table public.surprises rename to surprises_legacy;
alter table public.photos    rename to photos_legacy;
alter index if exists public.surprises_pkey       rename to surprises_legacy_pkey;
alter index if exists public.surprises_slug_key   rename to surprises_legacy_slug_key;
alter index if exists public.surprises_owner_idx  rename to surprises_legacy_owner_idx;
alter index if exists public.photos_pkey          rename to photos_legacy_pkey;
alter index if exists public.photos_surprise_idx  rename to photos_legacy_surprise_idx;

-- 2. The old public read function pointed at the old table/columns. The new app uses
--    get_public_surprise() instead. (The old website stops working at this point, so deploy
--    the new version right after finishing all three steps.)
drop function if exists public.get_surprise(text, text);

-- 3. Legacy tables are kept only as a backup: nobody can read them through the API.
revoke all on public.surprises_legacy, public.photos_legacy from anon, authenticated;

-- 4. The old 'photos' bucket was PUBLIC, so anyone who knew a file path could open it, even for
--    password-protected pages. Make it private. (The new app uses the 'surprise-media' bucket.)
update storage.buckets set public = false where id = 'photos';

-- ===== 001_schema.sql =====
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

-- ===== 002_functions.sql =====
-- LoveLink — 002: RPC functions (the ONLY public read path)

-- ---------------------------------------------------------------------------
-- set_surprise_password: owner-only; empty/NULL password removes protection.
-- The bcrypt hash is stored in surprise_secrets, which no API role can read.
-- ---------------------------------------------------------------------------
create or replace function public.set_surprise_password(p_surprise_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform 1 from public.surprises where id = p_surprise_id and owner_id = auth.uid();
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform set_config('app.pw_rpc', 'on', true);

  if p_password is null or p_password = '' then
    delete from public.surprise_secrets where surprise_id = p_surprise_id;
    update public.surprises set is_protected = false where id = p_surprise_id;
  else
    if char_length(p_password) < 4 or char_length(p_password) > 72 then
      raise exception 'invalid_password_length' using errcode = 'check_violation';
    end if;
    insert into public.surprise_secrets (surprise_id, password_hash)
    values (p_surprise_id, crypt(p_password, gen_salt('bf', 10)))
    on conflict (surprise_id)
    do update set password_hash = excluded.password_hash, updated_at = now();
    update public.surprises set is_protected = true where id = p_surprise_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_public_surprise: returns only fields meant for public viewing.
--   status: ok | password_required | wrong_password | locked | not_found
-- Password checking and throttling (8 failures / 15 min / page) happen here,
-- on the server, so protected content is never sent without the password.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_surprise(p_slug text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.surprises;
  h text;
  fails int;
  ok boolean;
begin
  if p_slug is null or char_length(p_slug) > 64 then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into s from public.surprises where slug = p_slug and status = 'published';
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if s.is_protected then
    if p_password is null or p_password = '' then
      return jsonb_build_object(
        'status', 'password_required',
        'surprise', jsonb_build_object('lang', s.lang, 'theme', s.theme)
      );
    end if;

    select count(*) into fails from public.password_attempts
     where slug = p_slug and success = false
       and attempted_at > now() - interval '15 minutes';
    if fails >= 8 then
      return jsonb_build_object('status', 'locked');
    end if;

    select password_hash into h from public.surprise_secrets where surprise_id = s.id;
    ok := h is not null and h = crypt(p_password, h);

    insert into public.password_attempts (slug, success) values (p_slug, ok);
    delete from public.password_attempts where attempted_at < now() - interval '1 day';

    if not ok then
      return jsonb_build_object('status', 'wrong_password');
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'surprise', jsonb_build_object(
      'slug', s.slug,
      'lang', s.lang,
      'nameA', s.name_a,
      'nameB', s.name_b,
      'title', s.title,
      'message', s.message,
      'theme', s.theme,
      'songUrl', coalesce(s.song_url, ''),
      'videoUrl', coalesce(s.video_url, ''),
      'specialDate', coalesce(s.special_date::text, ''),
      'specialDateLabel', s.special_date_label,
      'cards', s.cards,
      'timeline', s.timeline,
      'games', s.games,
      'finalButtonLabel', s.final_button_label,
      'finalMessage', s.final_message,
      'isProtected', s.is_protected,
      'photos', coalesce((
        select jsonb_agg(
                 jsonb_build_object('path', p.storage_path, 'caption', p.caption, 'kind', p.kind)
                 order by p.position, p.created_at)
          from public.surprise_photos p
         where p.surprise_id = s.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.set_surprise_password(uuid, text) from public;
revoke all on function public.get_public_surprise(text, text) from public;
grant execute on function public.set_surprise_password(uuid, text) to authenticated;
grant execute on function public.get_public_surprise(text, text) to anon, authenticated, service_role;

-- ===== 003_rls.sql =====
-- LoveLink — 003: Row Level Security
-- Anonymous visitors have NO direct table access. Public pages are read only
-- through public.get_public_surprise() (see 002_functions.sql).

alter table public.profiles          enable row level security;
alter table public.surprises         enable row level security;
alter table public.surprise_photos   enable row level security;
alter table public.surprise_secrets  enable row level security;  -- no policies: unreadable via API
alter table public.password_attempts enable row level security;  -- no policies: unreadable via API

-- Make the privilege model explicit (RLS still applies on top).
revoke all on public.profiles, public.surprises, public.surprise_photos,
              public.surprise_secrets, public.password_attempts from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.surprises to authenticated;
grant select, insert, update, delete on public.surprise_photos to authenticated;

-- profiles ------------------------------------------------------------------
create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- surprises -----------------------------------------------------------------
create policy "surprises: owner can read"
  on public.surprises for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "surprises: owner can insert"
  on public.surprises for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "surprises: owner can update"
  on public.surprises for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "surprises: owner can delete"
  on public.surprises for delete to authenticated
  using (owner_id = (select auth.uid()));

-- surprise_photos -----------------------------------------------------------
create policy "photos: owner can read"
  on public.surprise_photos for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "photos: owner can insert"
  on public.surprise_photos for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "photos: owner can update"
  on public.surprise_photos for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "photos: owner can delete"
  on public.surprise_photos for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ===== 004_storage.sql =====
-- LoveLink — 004: Storage bucket and policies
-- Bucket is PRIVATE. File size and MIME limits are enforced by Storage itself.
-- Object path convention: <owner_id>/<surprise_id>/<random-uuid>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'surprise-media', 'surprise-media', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- True only for files of a PUBLISHED, NOT password-protected surprise.
-- Protected pages' files are never readable by anonymous users; they are
-- delivered through the `protected-media` Edge Function after the password
-- has been verified server-side.
create or replace function public.is_public_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
      from public.surprises s
     where s.id::text       = (storage.foldername(object_name))[2]
       and s.owner_id::text = (storage.foldername(object_name))[1]
       and s.status = 'published'
       and s.is_protected = false
  );
$$;
revoke all on function public.is_public_media(text) from public;
grant execute on function public.is_public_media(text) to anon, authenticated;

drop policy if exists "media: owner read"   on storage.objects;
drop policy if exists "media: owner insert" on storage.objects;
drop policy if exists "media: owner update" on storage.objects;
drop policy if exists "media: owner delete" on storage.objects;
drop policy if exists "media: public read of published pages" on storage.objects;

create policy "media: owner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'surprise-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'surprise-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'surprise-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'surprise-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Lets visitors obtain signed URLs for photos of public, unprotected pages.
create policy "media: public read of published pages"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'surprise-media' and public.is_public_media(name));

-- ===== step2_import_old_data.sql =====
-- LoveLink — UPGRADE from the first version.
-- STEP 3 of 3. Run AFTER migrations 001–004 have succeeded.
--
-- Copies your existing surprises (same ids, same public links, same passwords) from
-- surprises_legacy into the new table. Old rows stay in *_legacy as a backup.
--
-- Not copied: photos. Old files live in the old 'photos' bucket under a different path scheme
-- that the new access rules do not use. Open each surprise in the editor and re-add its photos.
-- (The legacy photo list is still in photos_legacy.)

do $$
declare
  r record;
  song text;
  vid text;
  n_total int := 0;
  n_pw int := 0;
  n_links_dropped int := 0;
  n_photos int;
  url_re constant text := '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|spotify\.com)/.+';
  vid_re constant text := '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|vimeo\.com)/.+';
begin
  -- Bulk import: skip the per-row guards (quota etc.) and allow setting the protection flag.
  alter table public.surprises disable trigger surprises_guard_trg;
  perform set_config('app.pw_rpc', 'on', true);

  for r in select * from public.surprises_legacy order by created_at loop
    -- Links that do not match the new allow-list (https + YouTube/Spotify/Vimeo) are left empty.
    song := r.song_url;
    vid  := r.video_url;
    if song is not null and song !~* url_re then song := null; n_links_dropped := n_links_dropped + 1; end if;
    if vid  is not null and vid  !~* vid_re then vid  := null; n_links_dropped := n_links_dropped + 1; end if;

    insert into public.surprises (
      id, owner_id, slug, status, lang,
      name_a, name_b, title, message, theme,
      song_url, video_url, special_date, final_message,
      published_at, created_at, updated_at
    ) values (
      r.id, r.owner, r.slug, r.status,
      case when r.message ~ '[؀-ۿ]' then 'ar' else 'en' end,
      left(r.name_a, 60), left(r.name_b, 60),
      left(coalesce(nullif(btrim(r.title), ''), r.name_a || ' ♥ ' || r.name_b), 120),
      r.message, r.theme,
      song, vid, r.special_date, coalesce(r.final_message, ''),
      case when r.status = 'published' then r.updated_at end, r.created_at, r.updated_at
    );
    n_total := n_total + 1;

    if r.password_hash is not null then
      insert into public.surprise_secrets (surprise_id, password_hash) values (r.id, r.password_hash);
      update public.surprises set is_protected = true where id = r.id;
      n_pw := n_pw + 1;
    end if;
  end loop;

  alter table public.surprises enable trigger surprises_guard_trg;
  select count(*) into n_photos from public.photos_legacy;

  raise notice 'Imported % surprises (% password-protected).', n_total, n_pw;
  raise notice '% song/video links did not match the new allow-list and were left empty.', n_links_dropped;
  raise notice '% old photos were NOT copied; re-add them in the editor.', n_photos;
end $$;

commit;
