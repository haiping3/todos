-- Migration: Create todos table
-- Author: haiping.yu@zoom.us
-- Description: TODO items with priority, deadline, and AI suggestions

-- Create enum types
create type public.todo_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type public.todo_priority as enum ('low', 'medium', 'high', 'urgent');

-- Create todos table
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Core fields
  title text not null,
  description text,
  status public.todo_status default 'pending' not null,
  priority public.todo_priority default 'medium' not null,
  
  -- Time management
  deadline timestamptz,
  reminder timestamptz,
  completed_at timestamptz,
  
  -- Organization
  category text,
  tags text[] default '{}',
  
  -- AI features
  ai_suggestions jsonb default '[]'::jsonb,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.todos enable row level security;

-- Create trigger
create trigger update_todos_updated_at
  before update on public.todos
  for each row
  execute function public.update_updated_at_column();

-- RLS Policies

-- Users can view their own todos
create policy "todos_select_own"
  on public.todos
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own todos
create policy "todos_insert_own"
  on public.todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own todos
create policy "todos_update_own"
  on public.todos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own todos
create policy "todos_delete_own"
  on public.todos
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Create indexes
create index idx_todos_user_id on public.todos(user_id);
create index idx_todos_status on public.todos(status);
create index idx_todos_deadline on public.todos(deadline) where deadline is not null;
create index idx_todos_created_at on public.todos(created_at desc);

-- Add comments
comment on table public.todos is 'User TODO items with priority and deadline';
comment on column public.todos.ai_suggestions is 'AI-generated suggestions for priority, category, etc.';

-- Rollback:
-- drop table if exists public.todos;
-- drop type if exists public.todo_status;
-- drop type if exists public.todo_priority;

