-- Migration: Create knowledge_items table
-- Author: haiping.yu@zoom.us
-- Description: Knowledge base items (articles, notes)

-- Create enum types
create type public.knowledge_type as enum ('article', 'note');
create type public.knowledge_status as enum ('pending', 'processing', 'ready', 'error');

-- Create knowledge_items table
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Type and source
  type public.knowledge_type not null,
  url text,
  
  -- Content
  title text not null,
  content text,
  summary text,
  
  -- Organization
  category text,
  tags text[] default '{}',
  keywords text[] default '{}',
  
  -- Metadata
  source text,
  author text,
  published_at timestamptz,
  
  -- Processing status
  status public.knowledge_status default 'pending' not null,
  processing_error text,
  
  -- Timestamps
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.knowledge_items enable row level security;

-- Create trigger
create trigger update_knowledge_items_updated_at
  before update on public.knowledge_items
  for each row
  execute function public.update_updated_at_column();

-- RLS Policies

-- Users can view their own knowledge items
create policy "knowledge_items_select_own"
  on public.knowledge_items
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own knowledge items
create policy "knowledge_items_insert_own"
  on public.knowledge_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own knowledge items
create policy "knowledge_items_update_own"
  on public.knowledge_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own knowledge items
create policy "knowledge_items_delete_own"
  on public.knowledge_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Create indexes
create index idx_knowledge_items_user_id on public.knowledge_items(user_id);
create index idx_knowledge_items_status on public.knowledge_items(status);
create index idx_knowledge_items_created_at on public.knowledge_items(created_at desc);
create index idx_knowledge_items_url on public.knowledge_items(url) where url is not null;

-- Full-text search index
alter table public.knowledge_items add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored;

create index idx_knowledge_items_search on public.knowledge_items using gin(search_vector);

-- Add comments
comment on table public.knowledge_items is 'Personal knowledge base items';
comment on column public.knowledge_items.summary is 'AI-generated summary of the content';
comment on column public.knowledge_items.keywords is 'AI-extracted keywords for searching';

-- Rollback:
-- drop table if exists public.knowledge_items;
-- drop type if exists public.knowledge_type;
-- drop type if exists public.knowledge_status;

