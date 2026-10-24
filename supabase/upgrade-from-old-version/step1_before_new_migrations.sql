-- LoveLink - UPGRADE from the first version (the one created with 001_init.sql)
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
