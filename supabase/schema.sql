-- Climate pledge storage. Run this file in the Supabase SQL Editor.
create table if not exists public.climate_pledges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, action_id)
);

alter table public.climate_pledges enable row level security;

grant select, insert, delete on public.climate_pledges to authenticated;

create policy "Users can read their own climate pledges"
  on public.climate_pledges
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own climate pledges"
  on public.climate_pledges
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own climate pledges"
  on public.climate_pledges
  for delete
  to authenticated
  using (auth.uid() = user_id);
