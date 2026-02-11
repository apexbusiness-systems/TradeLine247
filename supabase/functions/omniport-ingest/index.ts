/**
 * OmniPort Ingress Endpoint
 *
 * Universal entry point for text, voice, and webhook inputs.
 * Implements zero-trust validation, idempotency, and risk classification.
 *
 * POST /functions/v1/omniport-ingest
 *
 * Body:
 * {
 *   "source": "text" | "voice" | "webhook" | "api" | "rcs" | "whatsapp",
 *   "content": "message content",
 *   "deviceId": "optional-device-id",
 *   "metadata": { ... }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { omniPort, type RawIngress, type IngressSource } from "../_shared/omniport.ts";
import { corsHeaders, errorResponse, successResponse } from "../_shared/security-middleware.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405, requestId);
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize OmniPort with database connection
    omniPort.initialize(supabase);

    // Parse request body
    const body = await req.json();

    // Validate required fields
    if (!body.source || !body.content) {
      return errorResponse("Missing required fields: source, content", 400, requestId);
    }

    // Validate source type
    const validSources: IngressSource[] = ["text", "voice", "webhook", "api", "rcs", "whatsapp"];
    if (!validSources.includes(body.source)) {
      return errorResponse(`Invalid source. Must be one of: ${validSources.join(", ")}`, 400, requestId);
    }

    // Build raw ingress input
    const input: RawIngress = {
      source: body.source as IngressSource,
      content: body.content,
      deviceId: body.deviceId,
      userId: body.userId,
      organizationId: body.organizationId,
      metadata: body.metadata,
      callbackUrl: body.callbackUrl,
      headers: {
        "user-agent": req.headers.get("user-agent") || "",
        "accept-language": req.headers.get("accept-language") || "",
        "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
      },
    };

    // Process through OmniPort
    const event = await omniPort.ingest(input);

    const duration = Date.now() - startTime;
    console.log(`[OmniPort-Ingest] Processed ${event.id} in ${duration}ms | lane=${event.security.lane}`);

    // Return canonical event
    return successResponse({
      eventId: event.id,
      traceId: event.traceId,
      lane: event.security.lane,
      riskScore: event.security.riskScore,
      flags: event.security.flags,
      destination: event.routing.destination,
      processedAt: new Date().toISOString(),
      durationMs: duration,
    }, 200, requestId);

  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Internal server error";

    console.error(`[OmniPort-Ingest] Error (${requestId}): ${message}`);

    // Return appropriate status based on error type
    if (message.includes("blocked")) {
      return errorResponse(message, 403, requestId);
    }

    return errorResponse(message, 500, requestId);
  }
});
