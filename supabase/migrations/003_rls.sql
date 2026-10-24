-- LoveLink - 003: Row Level Security
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
