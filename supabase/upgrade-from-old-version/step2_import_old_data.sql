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
