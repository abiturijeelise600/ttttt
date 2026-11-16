-- Climate Forward Supabase schema. Run in Supabase SQL Editor.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.climate_pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null check (action_id in ('travel','food','energy','nature')),
  created_at timestamptz not null default now(),
  unique (user_id,action_id)
);
alter table public.profiles enable row level security;
alter table public.climate_pledges enable row level security;
create or replace function public.is_climate_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function public.is_climate_admin() from public, anon;
grant execute on function public.is_climate_admin() to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name,phone) on public.profiles to authenticated;
grant select,insert,delete on public.climate_pledges to authenticated;
drop policy if exists "Read own or admin profiles" on public.profiles;
create policy "Read own or admin profiles" on public.profiles for select to authenticated using(user_id=(select auth.uid()) or (select public.is_climate_admin()));
drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Read own or admin pledges" on public.climate_pledges;
create policy "Read own or admin pledges" on public.climate_pledges for select to authenticated using(user_id=(select auth.uid()) or (select public.is_climate_admin()));
drop policy if exists "Insert own pledges" on public.climate_pledges;
create policy "Insert own pledges" on public.climate_pledges for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Delete own or admin pledges" on public.climate_pledges;
create policy "Delete own or admin pledges" on public.climate_pledges for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_climate_admin()));
create or replace function public.create_climate_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(user_id,display_name,phone,role) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''),coalesce(new.raw_user_meta_data->>'phone',''),'user') on conflict(user_id) do nothing;
 return new;
end; $$;
drop trigger if exists climate_profile_on_signup on auth.users;
create trigger climate_profile_on_signup after insert on auth.users for each row execute function public.create_climate_profile();
insert into public.profiles(user_id,display_name,phone,role) select id,coalesce(raw_user_meta_data->>'display_name',''),coalesce(raw_user_meta_data->>'phone',''),'user' from auth.users on conflict(user_id) do nothing;
-- Register the intended admin in Supabase Auth first, then promote using trusted SQL Editor:
-- update public.profiles set role='admin' where user_id=(select id from auth.users where lower(email)=lower('abiturijeelyse@gmail.com'));
