/**
 * Shared Security Module for Supabase Edge Functions
 * Implements authentication, CORS, and rate limiting as specified
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Parse and validate allowed origins from environment variable
 */
export function parseOriginAllowlist(req: Request): string[] {
  const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
  const origins = allowedOriginsStr.split(",").map(origin => origin.trim()).filter(Boolean);

  // Default to production origin if not configured
  if (origins.length === 0) {
    origins.push("https://aspiral.icu");
  }

  return origins;
}

/**
 * Generate CORS headers for the request origin
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = parseOriginAllowlist(req);

  const isAllowed = allowedOrigins.includes(origin) ||
    allowedOrigins.some(allowed => allowed === "*" || origin.startsWith(allowed));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-healthcheck-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Authenticate request using Bearer JWT token
 */
export async function requireAuth(req: Request): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized: Missing or invalid authorization header", {
      status: 401,
      headers: corsHeadersFor(req),
    });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new Response("Unauthorized: Invalid token", {
        status: 401,
        headers: corsHeadersFor(req),
      });
    }

    // Get user role from organization membership
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = memberData?.role || 'user';

    return { userId: user.id, role };
  } catch (error) {
    console.error("Authentication error:", error);
    throw new Response("Unauthorized: Authentication failed", {
      status: 401,
      headers: corsHeadersFor(req),
    });
  }
}

/**
 * Rate limiting implementation with Postgres backend
 */
export async function rateLimitOr429(options: {
  key: string;
  limit: number;
  windowSec: number;
  identifier?: string;
  userId?: string;
}): Promise<void> {
  const { key, limit, windowSec, identifier, userId } = options;

  try {
    // Use RPC function for rate limiting (would need to be created in DB)
    const { data: allowed, error } = await supabase.rpc('check_rate_limit_v2', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSec,
      p_identifier: identifier || userId || 'anonymous',
      p_user_id: userId
    });

    if (error) {
      console.error("Rate limit check error:", error);
      // Fail closed on rate limit system errors
      throw new Response("Service temporarily unavailable", { status: 503 });
    }

    if (!allowed) {
      throw new Response("Rate limit exceeded. Please try again later.", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(windowSec / 60).toString(),
        },
      });
    }
  } catch (response) {
    if (response instanceof Response) {
      throw response;
    }
    // Re-throw as service unavailable
    throw new Response("Service temporarily unavailable", { status: 503 });
  }
}

/**
 * Create a secure response with proper CORS headers
 */
export function createSecureResponse(
  data: any,
  options: {
    status?: number;
    req: Request;
    contentType?: string;
  }
): Response {
  const { status = 200, req, contentType = "application/json" } = options;

  const corsHeaders = corsHeadersFor(req);
  const headers = {
    ...corsHeaders,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  return new Response(
    typeof data === "string" ? data : JSON.stringify(data),
    { status, headers }
  );
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeadersFor(req),
    });
  }
  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeadersFor(req),
  });
}

/**
 * Validate request origin against allowlist
 */
export function validateOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = parseOriginAllowlist(req);

  return allowedOrigins.some(allowed =>
    allowed === "*" || origin === allowed || origin.startsWith(allowed)
  );
}