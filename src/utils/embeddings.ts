/**
 * Embedding generation utilities
 * Calls Supabase Edge Function (gte-small, no OpenAI required)
 * @author haiping.yu@zoom.us
 */

import { getSupabaseClient } from '@/lib/supabase';

interface GenerateEmbeddingResponse {
  success: boolean;
  knowledge_item_id: string;
  model: string;
  embedding_dimensions: number;
  error?: string;
}

interface GenerateEmbeddingError {
  error: string;
}

/**
 * Generate embedding for a knowledge item (stores in DB via Edge Function)
 * Uses Supabase built-in gte-small model.
 */
export async function generateEmbedding(
  knowledgeItemId: string,
  content: string,
  _model?: string
): Promise<{ success: boolean; error?: string }> {
  const client = await getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await client.functions.invoke<GenerateEmbeddingResponse | GenerateEmbeddingError>(
      'generate-embedding',
      {
        body: {
          knowledge_item_id: knowledgeItemId,
          content,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) {
      console.error('Edge Function error:', error);
      return { success: false, error: error.message || 'Failed to generate embedding' };
    }

    if (data && 'error' in data) {
      return { success: false, error: data.error };
    }

    if (data && 'success' in data && data.success) {
      console.log(`Successfully generated embedding for knowledge item ${knowledgeItemId}`);
      return { success: true };
    }

    return { success: false, error: 'Unexpected response from Edge Function' };
  } catch (error) {
    console.error('Generate embedding exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate embedding',
    };
  }
}

/**
 * Generate embedding for a search query via Edge Function (query_only mode, gte-small)
 * Used by semantic search; no OpenAI required.
 */
export async function generateEmbeddingForQuery(query: string): Promise<number[] | null> {
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

    if (error || !data?.embedding || !Array.isArray(data.embedding)) return null;
    return data.embedding;
  } catch {
    return null;
  }
}

/**
 * Check if embedding exists for a knowledge item
 * @param knowledgeItemId - The ID of the knowledge item
 * @returns Promise resolving to true if embedding exists
 */
export async function hasEmbedding(knowledgeItemId: string): Promise<boolean> {
  const client = await getSupabaseClient();
  if (!client) {
    return false;
  }

  try {
    const { data, error } = await client
      .from('embeddings')
      .select('id')
      .eq('knowledge_item_id', knowledgeItemId)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate embeddings for multiple knowledge items (batch processing)
 * @param items - Array of { id, content } objects
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to success count and errors
 */
export async function generateEmbeddingsBatch(
  items: Array<{ id: string; content: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<{ successCount: number; errors: Array<{ id: string; error: string }> }> {
  let successCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const result = await generateEmbedding(item.id, item.content);
    
    if (result.success) {
      successCount++;
    } else {
      errors.push({ id: item.id, error: result.error || 'Unknown error' });
    }

    if (onProgress) {
      onProgress(i + 1, items.length);
    }

    // Small delay to avoid rate limiting
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { successCount, errors };
}
