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
