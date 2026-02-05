-- Migration: Create embeddings table with pgvector
-- Author: haiping.yu@zoom.us
-- Description: Vector embeddings for semantic search
-- Reference: https://supabase.com/docs/guides/ai

-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Create embeddings table
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid references public.knowledge_items(id) on delete cascade not null unique,
  
  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding vector(1536),
  
  -- Model used to generate the embedding
  model text not null,
  
  -- Timestamps
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.embeddings enable row level security;

-- RLS Policies (based on knowledge item ownership)

-- Users can view embeddings of their own knowledge items
create policy "embeddings_select_own"
  on public.embeddings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = embeddings.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can insert embeddings for their own knowledge items
create policy "embeddings_insert_own"
  on public.embeddings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = embeddings.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can update embeddings for their own knowledge items
create policy "embeddings_update_own"
  on public.embeddings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = embeddings.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = embeddings.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Users can delete embeddings from their own knowledge items
create policy "embeddings_delete_own"
  on public.embeddings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_items
      where knowledge_items.id = embeddings.knowledge_item_id
        and knowledge_items.user_id = auth.uid()
    )
  );

-- Create indexes
create index idx_embeddings_knowledge_item_id on public.embeddings(knowledge_item_id);

-- Create HNSW index for fast similarity search
-- See: https://supabase.com/docs/guides/ai/vector-indexes
create index idx_embeddings_vector on public.embeddings 
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Function for semantic search
create or replace function public.search_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  p_user_id uuid default auth.uid()
)
returns table (
  id uuid,
  title text,
  summary text,
  url text,
  similarity float
)
language sql
security invoker
set search_path = public, extensions
stable
as $$
  select
    k.id,
    k.title,
    k.summary,
    k.url,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  inner join public.knowledge_items k on k.id = e.knowledge_item_id
  where k.user_id = p_user_id
    and k.status = 'ready'
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Add comments
comment on table public.embeddings is 'Vector embeddings for semantic search';
comment on column public.embeddings.embedding is 'Vector embedding (1536 dimensions for OpenAI)';
comment on function public.search_knowledge is 'Semantic search across user knowledge items';

-- Rollback:
-- drop function if exists public.search_knowledge;
-- drop table if exists public.embeddings;
-- drop extension if exists vector;

