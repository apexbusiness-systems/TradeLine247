/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Supabase Edge Function (Deno)
 * Purpose: RAG answer synthesis from retrieved context with rate limiting.
 * Security: Server-side rate limiting, input validation, audit logging
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAI } from 'https://esm.sh/openai@4.28.0';
import { corsHeaders, preflight } from '../_shared/cors.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.3; // Lower = more deterministic for RAG
const DEFAULT_MAX_TOKENS = 500; // Reasonable for concise answers

type AnyRecord = Record<string, unknown>;

type RagContextItem = {
  id?: string;
  text: string;
  score?: number;
  metadata?: AnyRecord;
};

type RagAnswerRequest = {
  question: string;
  context?: RagContextItem[];
  filters?: AnyRecord;
  lang?: string;           // optional language hint
  model?: string;          // e.g., "gpt-4o-mini" | "gpt-4.1" | etc.
  temperature?: number;    // model param passthrough
  maxTokens?: number;      // model param passthrough
};

type RagAnswerResponse = {
  ok: true;
  answer: string;
  citations: { id?: string; snippet: string }[];
  meta: {
    context_items: number;
    lang?: string;
    model?: string;
  };
  remaining?: number;
} | {
  ok: false;
  error: string;
  remaining?: number;
};

function normalizeRecord(input: unknown): AnyRecord {
  return input && typeof input === "object" ? (input as AnyRecord) : {};
}

/** ESLint-friendly own-property check */
function hasOwn(obj: AnyRecord, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

async function parseRequestJSON<T = unknown>(req: Request): Promise<T | AnyRecord> {
  try {
    const j = await req.json();
    return (j ?? {}) as T;
  } catch {
    return {};
  }
}

/** Rate limiting check using database RPC */
async function checkRateLimit(
  supabase: any,
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

function buildSystemPrompt(lang?: string): string {
  const basePrompt = `You are TradeLine 24/7's AI assistant, an expert in automotive trading, dealer operations, and business intelligence.

CRITICAL INSTRUCTIONS:
1. Answer ONLY using information from the provided context
2. If the context doesn't contain relevant information, say: "I don't have enough information in my knowledge base to answer that question accurately."
3. Never make up information or use knowledge outside the context
4. Be concise and professional - this is a business application
5. Cite specific parts of the context when possible
6. Focus on actionable insights for automotive dealers

FORMAT:
- Keep answers under 200 words unless complexity requires more
- Use bullet points for lists
- Include relevant metrics or numbers from the context
- Maintain professional automotive industry terminology`;

  // Language-specific instruction
  if (lang && !lang.toLowerCase().startsWith('en')) {
    return `${basePrompt}\n\n7. RESPOND IN ${lang.toUpperCase()} LANGUAGE.`;
  }

  return basePrompt;
}

function buildUserPrompt(question: string, context: RagContextItem[]): string {
  // Format context with clear separation
  const contextStr = context
    .map((item, idx) =>
      `[Context ${idx + 1}${item.id ? ` - ID: ${item.id}` : ''}]
${item.text}
---`
    )
    .join('\n\n');

  return `CONTEXT:
${contextStr}

QUESTION: ${question}

ANSWER:`;
}

function synthesizeAnswerStub(
  question: string,
  context: RagContextItem[],
  lang?: string
): { answer: string; citations: { id?: string; snippet: string }[] } {
  const topSnippets = context
    .slice(0, 3)
    .map((c) => (c?.text ?? "").trim())
    .filter(Boolean)
    .map((t) => (t.length > 320 ? `${t.slice(0, 317)}…` : t));

  const citations = context.slice(0, topSnippets.length).map((c, i) => ({
    id: c?.id,
    snippet: topSnippets[i],
  }));

  const langPrefix =
    lang && lang.toLowerCase().startsWith("en")
      ? ""
      : lang
      ? `[lang=${lang}] `
      : "";

  const baseAnswer =
    topSnippets.length > 0
      ? `Here's a concise answer grounded in the retrieved context: ${topSnippets[0]}`
      : `No context was provided. Based on the question alone, ensure retrieval runs before answer synthesis.`;

  return {
    answer: `${langPrefix}${baseAnswer}`,
    citations,
  };
}

async function synthesizeAnswer(
  question: string,
  context: RagContextItem[],
  model?: string,
  temperature?: number,
  maxTokens?: number,
  lang?: string
): Promise<{ answer: string; citations: { id?: string; snippet: string }[] }> {

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

  // Graceful degradation if no API key
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured - using stub response');
    return synthesizeAnswerStub(question, context, lang);
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const systemPrompt = buildSystemPrompt(lang);
    const userPrompt = buildUserPrompt(question, context);

    const completion = await openai.chat.completions.create({
      model: model || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    });

    const answer = completion.choices[0]?.message?.content ||
                   'Unable to generate answer from context.';

    // Extract citations from context (simple approach)
    const citations = context.slice(0, 5).map(c => ({
      id: c.id,
      snippet: (c.text || '').slice(0, 150) + (c.text?.length > 150 ? '...' : '')
    }));

    return { answer, citations };

  } catch (error) {
    console.error('OpenAI API error:', error);

    // Fail gracefully to stub on API errors
    console.warn('Falling back to stub due to OpenAI error');
    return synthesizeAnswerStub(question, context, lang);
  }
}

async function handleRagAnswer(req: Request): Promise<Response> {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' } as RagAnswerResponse),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client identifier for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `rag-answer:${clientIP}`;

    // Check rate limit: 30 requests per minute (more restrictive than search)
    const rateLimitResult = await checkRateLimit(supabase, rateLimitKey, 30, 60);
    
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for RAG answer: ${clientIP}`);
      
      // Log security event
      await supabase.from('analytics_events').insert({
        event_type: 'rate_limit_exceeded',
        event_data: { 
          endpoint: 'rag-answer',
          ip: clientIP,
          remaining: rateLimitResult.remaining
        },
        ip_address: clientIP
      });

      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Rate limit exceeded. Please try again later.',
          remaining: rateLimitResult.remaining
        } as RagAnswerResponse),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const bodyRaw = await parseRequestJSON<RagAnswerRequest>(req);
    const body = normalizeRecord(bodyRaw);

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const context = Array.isArray(body.context) ? (body.context as RagContextItem[]) : [];
    const filters = normalizeRecord(body.filters);
    const lang = typeof body.lang === "string" ? body.lang.trim() : undefined;
    const model = typeof body.model === "string" ? body.model.trim() : undefined;
    const temperature = typeof body.temperature === "number" ? body.temperature : undefined;
    const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : undefined;

    if (!question) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required field: 'question' (non-empty string).",
          remaining: rateLimitResult.remaining
        } as RagAnswerResponse),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If a language hint is provided only via filters.lang, surface it
    let effectiveLang = lang;
    if (!effectiveLang && hasOwn(filters, "lang")) {
      const fLang = filters["lang"];
      if (typeof fLang === "string" && fLang.trim()) {
        effectiveLang = fLang.trim();
      }
    }

    const { answer, citations } = await synthesizeAnswer(
      question,
      context,
      model,
      temperature,
      maxTokens,
      effectiveLang
    );

    const payload: RagAnswerResponse = {
      ok: true,
      answer,
      citations,
      meta: {
        context_items: context.length,
        lang: effectiveLang,
        model,
      },
      remaining: rateLimitResult.remaining - 1
    };

    // Log successful request
    await supabase.from('analytics_events').insert({
      event_type: 'rag_answer_request',
      event_data: { 
        question_length: question.length,
        context_items: context.length,
        ip: clientIP,
        remaining: rateLimitResult.remaining - 1
      },
      ip_address: clientIP
    });

    return new Response(
      JSON.stringify(payload),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('RAG answer error:', err);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      } as RagAnswerResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

/** Deno / Supabase Edge entrypoint */
Deno.serve((req: Request) => handleRagAnswer(req));
