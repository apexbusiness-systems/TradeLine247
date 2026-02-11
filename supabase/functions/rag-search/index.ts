/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supabase Edge Function (Deno)
 * Purpose: RAG search with rate limiting, optional language filter, and user context.
 * Security: Server-side rate limiting, input validation, audit logging, RLS enforcement
 */

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, preflight } from '../_shared/cors.ts';
import { normalizeTextForEmbedding } from '../_shared/textNormalization.ts';

type AnyRecord = Record<string, unknown>;

function normalizeRecord(input: unknown): AnyRecord {
  return input && typeof input === "object" ? (input as AnyRecord) : {};
}

/** Safe own-property check (ESLint-friendly, no prototype calls on user objects) */
function hasOwn(obj: AnyRecord, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Rate limiting check using database RPC */
async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { data, error } = await supabase.rpc('secure_rate_limit', {
      identifier,
      max_requests: maxRequests,
      window_seconds: windowSeconds
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // Fail closed - deny on error
      return { allowed: false, remaining: 0 };
    }

    const result = data as { allowed: boolean; remaining: number; limit: number };
    return {
      allowed: result?.allowed ?? false,
      remaining: result?.remaining ?? 0
    };
  } catch (err) {
    console.error('Rate limit exception:', err);
    // Fail closed - deny on error
    return { allowed: false, remaining: 0 };
  }
}

function initSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function enforceRateLimit(
  supabaseAdmin: SupabaseClient,
  req: Request
): Promise<{ allowed: boolean; remaining: number; clientIP: string }> {
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
  const rateLimitKey = `rag-search:${clientIP}`;

  // Check rate limit: 60 requests per minute
  const result = await checkRateLimit(supabaseAdmin, rateLimitKey, 60, 60);

  if (!result.allowed) {
    console.warn(`Rate limit exceeded for RAG search: ${clientIP}`);

    // Log security event
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'rate_limit_exceeded',
      event_data: {
        endpoint: 'rag-search',
        ip: clientIP,
        remaining: result.remaining
      },
      ip_address: clientIP
    });
  }

  return { ...result, clientIP };
}

async function authenticateUser(req: Request): Promise<{ user: User; supabaseUser: SupabaseClient } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) {
    console.warn('Auth error:', error);
    return null;
  }

  return { user, supabaseUser };
}

function resolveOrgId(body: AnyRecord, filters: AnyRecord, user: User): string | undefined {
  if (typeof body.orgId === "string") {
    return body.orgId;
  }
  if (typeof filters.org_id === "string") {
    return filters.org_id;
  }
  if (user.app_metadata && typeof user.app_metadata.org_id === 'string') {
    return user.app_metadata.org_id;
  }
  return undefined;
}

async function generateQueryEmbedding(text: string, lang?: string): Promise<number[]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const { normalized } = normalizeTextForEmbedding(text, lang);

  const embeddingResp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: normalized,
      dimensions: 1536
    })
  });

  if (!embeddingResp.ok) {
    const errText = await embeddingResp.text();
    console.error('OpenAI API Error:', errText);
    throw new Error(`OpenAI API error: ${errText}`);
  }

  const embeddingData = await embeddingResp.json();
  return embeddingData.data[0].embedding;
}

async function executeSearch(
  supabaseUser: SupabaseClient,
  orgId: string,
  user: User,
  embedding: number[],
  matchCount: number,
  threshold: number
): Promise<any[]> {
  // Run parallel searches
  const [emailResults, callResults] = await Promise.all([
    supabaseUser.rpc('match_email_chunks', {
      query_org_id: orgId,
      query_user_id: user.id,
      query_embedding: JSON.stringify(embedding),
      match_count: matchCount,
      similarity_threshold: threshold
    }),
    supabaseUser.rpc('match_call_chunks', {
      query_org_id: orgId,
      query_embedding: JSON.stringify(embedding),
      match_count: matchCount,
      similarity_threshold: threshold
    })
  ]);

  if (emailResults.error) {
    console.warn('Email search RPC error:', emailResults.error);
  }
  if (callResults.error) {
    console.warn('Call search RPC error:', callResults.error);
  }

  return [
    ...(emailResults.data || []).map((r: any) => ({ ...r, type: 'email' })),
    ...(callResults.data || []).map((r: any) => ({ ...r, type: 'call' }))
  ].sort((a: any, b: any) => b.similarity - a.similarity).slice(0, matchCount);
}

async function handleRagSearch(req: Request): Promise<Response> {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseAdmin = initSupabaseAdmin();
    const { allowed, remaining, clientIP } = await enforceRateLimit(supabaseAdmin, req);
    
    if (!allowed) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Rate limit exceeded. Please try again later.',
          remaining
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authResult = await authenticateUser(req);
    if (!authResult) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized: Invalid token or missing header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { user, supabaseUser } = authResult;

    // Parse request body
    const bodyRaw = await req.json().catch(() => ({}));
    const body: AnyRecord = normalizeRecord(bodyRaw);

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
       return new Response(
         JSON.stringify({ ok: false, error: "Missing required field: 'query'" }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    const filters = normalizeRecord(body.filters);
    const queryLang = typeof body.queryLang === "string" ? body.queryLang.trim() : undefined;
    const autoLang = typeof body.autoLang === "boolean" ? body.autoLang : undefined;

    const orgId = resolveOrgId(body, filters, user);
    if (!orgId) {
       return new Response(
         JSON.stringify({ ok: false, error: "Missing required field: 'orgId' (in body, filters, or user metadata)" }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    // Apply language filter logic
    if (!hasOwn(filters, "lang") && queryLang && autoLang !== false) {
      (filters as AnyRecord).lang = queryLang;
    }

    const embedding = await generateQueryEmbedding(query, queryLang);

    const matchCount = typeof body.match_count === 'number' ? body.match_count : 10;
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.7;

    const combinedResults = await executeSearch(supabaseUser, orgId, user, embedding, matchCount, threshold);

    const payload = {
      ok: true,
      query,
      orgId,
      filters,
      results: combinedResults,
      remaining: remaining - 1
    };

    // Log successful request
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'rag_search_request',
      event_data: { 
        filters,
        org_id: orgId,
        user_id: user.id,
        result_count: combinedResults.length,
        ip: clientIP,
        remaining: remaining - 1
      },
      ip_address: clientIP
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error('RAG search error:', err);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/** Deno / Supabase Edge entrypoint */
Deno.serve((req: Request) => handleRagSearch(req));
