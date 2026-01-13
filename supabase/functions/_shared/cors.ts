/**
 * CORS Configuration for Supabase Edge Functions
 *
 * SECURITY: Origin validation with whitelist approach
 * Allows only known production and development origins
 */

// Allowed origins whitelist - add new domains here
const ALLOWED_ORIGINS = [
  // Production
  'https://www.tradeline247ai.com',
  'https://tradeline247ai.com',
  'https://app.tradeline247ai.com',
  // Supabase hosted
  'https://hysvqdwmhxnblxfqnszn.supabase.co',
  // Preview/Staging (Vercel)
  'https://tradeline247.vercel.app',
  // Development
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:4176',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4176',
];

// Pattern for Vercel preview deployments
const VERCEL_PREVIEW_PATTERN = /^https:\/\/tradeline247[a-z0-9-]*\.vercel\.app$/;
const LOVABLE_PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.lovable\.app$/;

const ALLOW_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-request-id",
  "x-twilio-signature",
  "x-csrf-token",
].join(", ");

/**
 * Validate if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check Vercel preview pattern
  if (VERCEL_PREVIEW_PATTERN.test(origin)) return true;

  // Check Lovable preview pattern
  if (LOVABLE_PREVIEW_PATTERN.test(origin)) return true;

  return false;
}

/**
 * Get CORS headers with validated origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin!,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getCorsHeaders(origin) instead for proper origin validation
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": ALLOW_HEADERS,
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

/**
 * Handle preflight OPTIONS request with origin validation
 */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;

  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers: {
      ...headers,
      "Content-Length": "0",
    },
  });
}

/**
 * Create JSON response with proper CORS headers
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  req?: Request
): Response {
  const origin = req?.headers.get("origin") ?? null;
  const headers = getCorsHeaders(origin);

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create error response with proper CORS headers
 */
export function unexpectedErrorResponse(error: unknown, req?: Request): Response {
  console.error("Unexpected error:", error);
  return jsonResponse(
    { error: error instanceof Error ? error.message : "Unexpected error" },
    500,
    req
  );
}

/**
 * Merge CORS headers with custom headers
 */
export function withCors(
  headers: Record<string, string>,
  origin?: string | null
): Record<string, string> {
  const corsH = origin !== undefined ? getCorsHeaders(origin) : corsHeaders;
  return {
    ...corsH,
    ...headers,
  };
}

/**
 * Merge multiple header sets
 */
export function mergeHeaders(
  ...headerSets: Record<string, string>[]
): Record<string, string> {
  return Object.assign({}, ...headerSets);
}

/**
 * Handle CORS preflight request
 */
export function handleCors(req: Request): Response | null {
  return preflight(req);
}

/**
 * Middleware to validate origin and reject unauthorized requests
 */
export function validateOrigin(req: Request): { valid: boolean; origin: string | null } {
  const origin = req.headers.get("origin");

  // Allow requests without origin (same-origin, curl, etc.)
  if (!origin) {
    return { valid: true, origin: null };
  }

  return { valid: isOriginAllowed(origin), origin };
}
