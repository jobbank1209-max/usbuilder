-- Run this once in Supabase: SQL Editor > New query > paste > Run

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  username   text unique,
  email      text,
  role       text not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id           bigint generated always as identity primary key,
  name         text not null,
  email        text not null,
  phone        text,
  project_type text,
  budget       text,
  start_when   text,
  message      text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Create a profile row automatically for every new sign up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, username, email)
  values (new.id, new.raw_user_meta_data->>'name', lower(new.raw_user_meta_data->>'username'), new.email);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the signed in user an admin?
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Let people log in with a username (returns the email for that username)
create or replace function public.email_for_username(u text) returns text
language sql security definer set search_path = public stable as $$
  select email from public.profiles where username = lower(u) limit 1;
$$;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- Row level security: the public key can only do what is allowed here
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "anyone can send an enquiry" on public.contacts;
create policy "anyone can send an enquiry" on public.contacts for insert to anon, authenticated with check (true);

drop policy if exists "admin reads enquiries" on public.contacts;
create policy "admin reads enquiries" on public.contacts for select to authenticated using (public.is_admin());

drop policy if exists "admin updates enquiries" on public.contacts;
create policy "admin updates enquiries" on public.contacts for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- After you sign up once with YOUR email, make that account the admin (replace the email):
-- update public.profiles set role = 'admin' where email = 'you@yourdomain.com';
