/**
 * Supabase Edge Function: Generate Embedding
 * Uses Supabase built-in gte-small model (no OpenAI or external API).
 * Supports: (1) store embedding for a knowledge item, (2) query_only to return embedding for search.
 * JWT 在函数内通过 Supabase JWKS 校验，要求 Authorization: Bearer <access_token>。
 * @author haiping.yu@zoom.us
 * @see https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings
 * @see https://supabase.com/docs/guides/functions/auth
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'jsr:@panva/jose@6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = 'gte-small';

interface GenerateEmbeddingRequest {
  knowledge_item_id?: string;
  content: string;
  query_only?: boolean;
}

function getAuthToken(req: Request): string {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 2 || parts[0] !== 'Bearer' || !parts[1]) {
    throw new Error("Authorization must be 'Bearer <token>'");
  }
  return parts[1];
}

function createJwtVerifier(supabaseUrl: string) {
  const issuer = Deno.env.get('SB_JWT_ISSUER') ?? `${supabaseUrl}/auth/v1`;
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  return (jwt: string) => jose.jwtVerify(jwt, jwks, { issuer });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    let authHeader: string;
    try {
      const token = getAuthToken(req);
      const verify = createJwtVerifier(supabaseUrl);
      await verify(token);
      authHeader = `Bearer ${token}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JWT';
      return new Response(
        JSON.stringify({ error: 'Unauthorized', detail: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', detail: authError?.message ?? 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const body = (await req.json()) as GenerateEmbeddingRequest;
    const { knowledge_item_id, content, query_only } = body;

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: content' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const contentSlice = content.slice(0, 8000);

    // Supabase built-in embedding (no external API)
    // @ts-expect-error Supabase.ai is available in Edge Runtime
    const session = new Supabase.ai.Session(MODEL);
    const embedding = await session.run(contentSlice, {
      mean_pool: true,
      normalize: true,
    }) as number[];

    if (!Array.isArray(embedding)) {
      throw new Error('Embedding from session.run was not an array');
    }

    // Query-only: return embedding for search (e.g. semantic search query)
    if (query_only) {
      return new Response(
        JSON.stringify({ embedding }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!knowledge_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing knowledge_item_id when not query_only' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify the knowledge item belongs to the user
    const { data: knowledgeItem, error: itemError } = await userClient
      .from('knowledge_items')
      .select('id, user_id, status')
      .eq('id', knowledge_item_id)
      .single();

    if (itemError || !knowledgeItem) {
      return new Response(
        JSON.stringify({ error: 'Knowledge item not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (knowledgeItem.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Knowledge item does not belong to user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: dbError } = await adminClient
      .from('embeddings')
      .upsert(
        { knowledge_item_id, embedding, model: MODEL },
        { onConflict: 'knowledge_item_id' }
      );

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to store embedding: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        knowledge_item_id,
        model: MODEL,
        embedding_dimensions: embedding.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Generate embedding error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
