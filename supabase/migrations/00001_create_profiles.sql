-- Migration: Create profiles table
-- Author: haiping.yu@zoom.us
-- Description: User profiles with settings

-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  full_name text,
  avatar_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create updated_at trigger function (shared)
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

-- RLS Policies

-- Users can view their own profile
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own profile
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own profile
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own profile
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Create index
create index idx_profiles_user_id on public.profiles(user_id);

-- Add comments
comment on table public.profiles is 'User profiles with personal settings';
comment on column public.profiles.settings is 'JSON settings including AI config, sync preferences, etc.';

-- Rollback:
-- drop table if exists public.profiles;
-- drop function if exists public.update_updated_at_column();

