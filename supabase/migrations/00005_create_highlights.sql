-- Migration: Create highlights table
-- Author: haiping.yu@zoom.us
-- Description: User highlights and annotations on knowledge items

-- Create highlights table
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid references public.knowledge_items(id) on delete cascade not null,
  
  -- Highlight content
  highlighted_text text not null,
  note text,
  
  -- Position in content
  start_pos integer not null,
  end_pos integer not null,
  
  -- Timestamps
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.highlights enable row level security;

-- RLS Policies (based on knowledge item ownership)

-- Users can view highlights of their own knowledge items
create policy "highlights_select_own"
  on public.highlights
  for select
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = highlights.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can insert highlights to their own knowledge items
create policy "highlights_insert_own"
  on public.highlights
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = highlights.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can update highlights on their own knowledge items
create policy "highlights_update_own"
  on public.highlights
  for update
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = highlights.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = highlights.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can delete highlights from their own knowledge items
create policy "highlights_delete_own"
  on public.highlights
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = highlights.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Create indexes
create index idx_highlights_knowledge_item_id on public.highlights(knowledge_item_id);

-- Add comments
comment on table public.highlights is 'User highlights and annotations on knowledge items';

-- Rollback:
-- drop table if exists public.highlights;

