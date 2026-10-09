-- LoveLink schema. Run in Supabase SQL Editor (or `supabase db push`).
create extension if not exists pgcrypto with schema extensions;

create table public.surprises (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[A-Za-z0-9]{12,24}$'),
  status text not null default 'draft' check (status in ('draft','published')),
  name_a text not null check (char_length(name_a) between 1 and 60),
  name_b text not null check (char_length(name_b) between 1 and 60),
  title text check (char_length(title) <= 120),
  message text not null check (char_length(message) between 1 and 5000),
  theme text not null default 'elegant' check (theme in ('cute','elegant','cinematic','minimal')),
  song_url text check (char_length(song_url) <= 300),
  video_url text check (char_length(video_url) <= 300),
  special_date date,
  final_message text check (char_length(final_message) <= 1000),
  password_plain text,          -- transient: hashed by trigger, never stored
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surprises_owner_idx on public.surprises(owner);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  surprise_id uuid not null references public.surprises(id) on delete cascade,
  path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index photos_surprise_idx on public.photos(surprise_id);

create or replace function public.surprises_before_write() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.password_plain is not null and new.password_plain <> '' then
    if char_length(new.password_plain) < 6 then raise exception 'password too short'; end if;
    new.password_hash := crypt(new.password_plain, gen_salt('bf'));
  end if;
  new.password_plain := null;
  new.updated_at := now();
  return new;
end $$;
create trigger surprises_bw before insert or update on public.surprises
  for each row execute function public.surprises_before_write();

alter table public.surprises enable row level security;
alter table public.photos enable row level security;

create policy "owner select" on public.surprises for select using (owner = auth.uid());
create policy "owner insert" on public.surprises for insert with check (owner = auth.uid());
create policy "owner update" on public.surprises for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner delete" on public.surprises for delete using (owner = auth.uid());

create policy "owner photos" on public.photos for all
  using (exists (select 1 from public.surprises s where s.id = surprise_id and s.owner = auth.uid()))
  with check (exists (select 1 from public.surprises s where s.id = surprise_id and s.owner = auth.uid()));

-- Public read goes ONLY through this function; password is verified server-side.
create or replace function public.get_surprise(p_slug text, p_password text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.surprises; ph jsonb;
begin
  select * into s from public.surprises where slug = p_slug and status = 'published';
  if not found then return null; end if;
  if s.password_hash is not null and (p_password is null or crypt(p_password, s.password_hash) <> s.password_hash) then
    return jsonb_build_object('locked', true);
  end if;
  select coalesce(jsonb_agg(path order by position), '[]') into ph from public.photos where surprise_id = s.id;
  return jsonb_build_object('locked', false, 'name_a', s.name_a, 'name_b', s.name_b, 'title', s.title,
    'message', s.message, 'theme', s.theme, 'song_url', s.song_url, 'video_url', s.video_url,
    'special_date', s.special_date, 'final_message', s.final_message, 'photos', ph);
end $$;
revoke all on function public.get_surprise(text, text) from public;
grant execute on function public.get_surprise(text, text) to anon, authenticated;

-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
