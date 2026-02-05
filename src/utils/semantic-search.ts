/**
 * Semantic search utilities
 * Implements vector similarity search using pgvector and Supabase gte-small embeddings
 * @author haiping.yu@zoom.us
 */

import { getSupabaseClient } from '@/lib/supabase';
import type { KnowledgeItem } from '@/types';

export interface SemanticSearchResult {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  similarity: number;
}

/**
 * Generate query embedding via Supabase Edge Function (gte-small, no OpenAI needed)
 */
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const client = await getSupabaseClient();
  if (!client) return null;

  try {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session) return null;

    const { data, error } = await client.functions.invoke<{ embedding?: number[] }>(
      'generate-embedding',
      {
        body: { content: query.trim(), query_only: true },
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );

    if (error || !data?.embedding || !Array.isArray(data.embedding)) {
      if (error) console.warn('Query embedding Edge Function error:', error);
      return null;
    }
    return data.embedding;
  } catch (e) {
    console.warn('Query embedding failed', e);
    return null;
  }
}

/**
 * Perform semantic search across knowledge items
 * @param query - The search query text
 * @param options - Search options
 * @returns Promise resolving to search results with similarity scores
 */
export async function semanticSearch(
  query: string,
  options: {
    threshold?: number;
    limit?: number;
  } = {}
): Promise<{ results: SemanticSearchResult[]; error: string | null }> {
  const { threshold = 0.5, limit = 10 } = options;

  const client = await getSupabaseClient();
  if (!client) {
    return { results: [], error: 'Supabase not configured' };
  }

  try {
    // Verify user is authenticated
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return { results: [], error: 'User not authenticated' };
    }

    const queryEmbedding = await generateQueryEmbedding(query);
    if (!queryEmbedding) {
      return {
        results: [],
        error: 'Failed to generate query embedding. Ensure you are signed in and the generate-embedding Edge Function is deployed.',
      };
    }

    // Call the search_knowledge database function (typed via assertion; DB Functions not in generated types)
    type SearchRow = { id: string; title: string; summary: string | null; url: string | null; similarity: number };
    const { data, error } = await (client as unknown as {
      rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: SearchRow[] | null; error: { message: string } | null }>;
    }).rpc('search_knowledge', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Semantic search error:', error);
      return { results: [], error: error.message };
    }

    const results: SemanticSearchResult[] = (data || []).map((item: SearchRow) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      url: item.url,
      similarity: item.similarity,
    }));

    return { results, error: null };
  } catch (error) {
    console.error('Semantic search exception:', error);
    return {
      results: [],
      error: error instanceof Error ? error.message : 'Failed to perform semantic search',
    };
  }
}

/**
 * Convert semantic search results to KnowledgeItem format
 * Fetches full knowledge item data for each result
 */
export async function semanticSearchToKnowledgeItems(
  results: SemanticSearchResult[]
): Promise<KnowledgeItem[]> {
  if (results.length === 0) {
    return [];
  }

  const client = await getSupabaseClient();
  if (!client) {
    return [];
  }

  try {
    const ids = results.map(r => r.id);
    const { data, error } = await client
      .from('knowledge_items')
      .select('*')
      .in('id', ids);

    if (error || !data) {
      console.error('Failed to fetch knowledge items:', error);
      return [];
    }

    // Map to KnowledgeItem format and preserve similarity order
    const resultMap = new Map(results.map(r => [r.id, r]));
    return data
      .map((item: unknown) => {
        const dbItem = item as {
          id: string;
          title: string;
          content: string | null;
          summary: string | null;
          url: string | null;
          keywords: string[];
          tags: string[];
          category: string | null;
          source: string | null;
          author: string | null;
          published_at: string | null;
          status: string;
          processing_error: string | null;
          created_at: string;
          updated_at: string;
        };

        return {
          id: dbItem.id,
          type: dbItem.url ? 'article' : 'note' as const,
          url: dbItem.url || undefined,
          title: dbItem.title,
          content: dbItem.content || undefined,
          summary: dbItem.summary || undefined,
          keywords: dbItem.keywords || [],
          tags: dbItem.tags || [],
          category: dbItem.category || undefined,
          source: dbItem.source || undefined,
          author: dbItem.author || undefined,
          publishedAt: dbItem.published_at ? new Date(dbItem.published_at) : undefined,
          status: dbItem.status as KnowledgeItem['status'],
          processingError: dbItem.processing_error || undefined,
          createdAt: new Date(dbItem.created_at),
          updatedAt: new Date(dbItem.updated_at),
        } as KnowledgeItem;
      })
      .sort((a, b) => {
        // Sort by similarity (descending)
        const simA = resultMap.get(a.id)?.similarity || 0;
        const simB = resultMap.get(b.id)?.similarity || 0;
        return simB - simA;
      });
  } catch (error) {
    console.error('Failed to convert semantic search results:', error);
    return [];
  }
}
