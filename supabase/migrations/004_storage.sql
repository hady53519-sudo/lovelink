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
