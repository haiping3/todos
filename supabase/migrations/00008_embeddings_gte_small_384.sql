-- Migration: Switch embeddings to gte-small (384 dimensions)
-- Author: haiping.yu@zoom.us
-- gte-small is Supabase built-in; no OpenAI required.
-- Existing 1536-dim rows are dropped; new embeddings will be 384-dim.

drop index if exists public.idx_embeddings_vector;

alter table public.embeddings drop column if exists embedding;
alter table public.embeddings add column embedding vector(384);

create index idx_embeddings_vector on public.embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

drop function if exists public.search_knowledge(vector(1536), float, int, uuid);

create or replace function public.search_knowledge(
  query_embedding vector(384),
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

comment on column public.embeddings.embedding is 'Vector embedding (384 dimensions, Supabase gte-small)';
