-- Migration: Create attachments table
-- Author: haiping.yu@zoom.us
-- Description: File attachments for TODO items

-- Create enum type
create type public.attachment_type as enum ('image', 'file');

-- Create attachments table
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid references public.todos(id) on delete cascade not null,
  
  -- File info
  type public.attachment_type not null,
  name text not null,
  size bigint not null,
  mime_type text not null,
  
  -- Storage paths
  storage_path text not null,
  thumbnail_path text,
  
  -- Timestamps
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.attachments enable row level security;

-- RLS Policies (based on todo ownership)

-- Users can view attachments of their own todos
create policy "attachments_select_own"
  on public.attachments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.todos
      where todos.id = attachments.todo_id
        and todos.user_id = auth.uid()
    )
  );

-- Users can insert attachments to their own todos
create policy "attachments_insert_own"
  on public.attachments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.todos
      where todos.id = attachments.todo_id
        and todos.user_id = auth.uid()
    )
  );

-- Users can delete attachments from their own todos
create policy "attachments_delete_own"
  on public.attachments
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.todos
      where todos.id = attachments.todo_id
        and todos.user_id = auth.uid()
    )
  );

-- Create indexes
create index idx_attachments_todo_id on public.attachments(todo_id);

-- Add comments
comment on table public.attachments is 'File attachments for TODO items';
comment on column public.attachments.storage_path is 'Path in Supabase Storage bucket';

-- Rollback:
-- drop table if exists public.attachments;
-- drop type if exists public.attachment_type;

