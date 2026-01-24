/**
 * OmniPort Metrics Proxy Endpoint
 *
 * Fetches real-time metrics FROM the OmniPort platform.
 * TradeLine 24/7 is a CLIENT connecting to OmniPort, not the hub.
 *
 * GET /functions/v1/omniport-metrics
 *
 * Query params:
 *   - range: "1h" | "24h" | "7d" (default: "1h")
 *   - format: "summary" | "detailed" (default: "summary")
 *
 * Returns metrics from OmniPort platform:
 * {
 *   totalRequests: 10537,
 *   successRate: "99.2%",
 *   p95Latency: "47ms",
 *   healthStatus: "healthy" | "degraded" | "unhealthy",
 *   dlqDepth: 3,
 *   bySource: { text: 7234, voice: 2156, webhook: 1147, ... },
 *   byLane: { GREEN: 9800, YELLOW: 600, RED: 100, BLOCKED: 37 }
 * }
 *
 * Environment Variables Required:
 *   OMNI_PORT_BASE_URL - OmniPort platform URL
 *   OMNI_PORT_SERVICE_KEY - Service key for authentication
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getOmniPortClient } from "../_shared/omniport-client.ts";
import { corsHeaders, errorResponse, successResponse } from "../_shared/security-middleware.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    // Only accept GET
    if (req.method !== "GET") {
      return errorResponse("Method not allowed", 405, requestId);
    }

    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "1h") as "1h" | "24h" | "7d";
    const format = url.searchParams.get("format") || "summary";

    // Get OmniPort client (connects to external OmniPort platform)
    const omniPortClient = getOmniPortClient();

    if (!omniPortClient.isInitialized()) {
      return errorResponse(
        "OmniPort connection not configured. Contact administrator.",
        503,
        requestId
      );
    }

    // Fetch metrics FROM OmniPort platform
    const metrics = await omniPortClient.getMetrics(range);

    // Add connection metadata
    const response = {
      ...metrics,
      connection: {
        status: "connected",
        platform: "OmniPort",
        fetchedAt: new Date().toISOString(),
        range,
      },
    };

    // Handle detailed format - fetch additional data from OmniPort
    if (format === "detailed") {
      const [dlqDepth, recentEvents] = await Promise.all([
        omniPortClient.getDLQDepth(),
        omniPortClient.getRecentEvents(20),
      ]);

      return successResponse(
        {
          ...response,
          dlqDepth,
          recentEvents,
        },
        200,
        requestId
      );
    }

    // Default: summary format
    return successResponse(response, 200, requestId);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch OmniPort metrics";
    console.error(`[OmniPort-Metrics] Error (${requestId}): ${message}`);

    // Return degraded response if OmniPort is unreachable
    if (message.includes("credentials not configured")) {
      return errorResponse(
        "OmniPort integration not configured",
        503,
        requestId
      );
    }

    return errorResponse(message, 500, requestId);
  }
});
