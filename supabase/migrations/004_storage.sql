-- LoveLink - 004: Storage bucket and policies
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

-- Visitors never read Storage directly (so nobody can list files). Photos reach them as
-- long-lived signed URLs delivered by get_public_surprise() (see 002_functions.sql).
drop policy if exists "media: public read of published pages" on storage.objects;
drop function if exists public.is_public_media(text);

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
