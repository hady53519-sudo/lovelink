-- LoveLink - 005: photos reach visitors as stored signed URLs (no Edge Function needed)
-- Run ONCE, only if you already ran migrations 001-004 (or UPGRADE_ALL_IN_ONE.sql) BEFORE this
-- update. Fresh installs already include this in 001-004 and must NOT run it.
--
-- After running it, open "My surprises" once while logged in: the app signs your existing
-- photos automatically and stores their URLs, and the pictures appear on your public pages.

alter table public.surprise_photos
  add column if not exists signed_url text,
  add column if not exists signed_until timestamptz;

alter table public.surprise_photos drop constraint if exists surprise_photos_signed_url_check;
alter table public.surprise_photos add constraint surprise_photos_signed_url_check check (
  signed_url is null or (
    char_length(signed_url) <= 1500 and
    signed_url ~ '^https://[a-z0-9.-]+/storage/v1/object/sign/surprise-media/'));

-- Visitors no longer read Storage directly (nobody can list files).
drop policy if exists "media: public read of published pages" on storage.objects;
drop function if exists public.is_public_media(text);

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
                 jsonb_build_object('path', p.storage_path, 'caption', p.caption, 'kind', p.kind,
                                    'url', case when p.signed_until > now() then coalesce(p.signed_url, '') else '' end)
                 order by p.position, p.created_at)
          from public.surprise_photos p
         where p.surprise_id = s.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_public_surprise(text, text) from public;
grant execute on function public.get_public_surprise(text, text) to anon, authenticated, service_role;
