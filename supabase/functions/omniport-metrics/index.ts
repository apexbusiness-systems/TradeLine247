/**
 * OmniPort Metrics Endpoint
 *
 * Returns real-time metrics for OmniDash dashboards.
 * Provides SLA tracking, source breakdowns, and health monitoring.
 *
 * GET /functions/v1/omniport-metrics
 *
 * Query params:
 *   - range: "1h" | "24h" | "7d" (default: "1h")
 *   - format: "summary" | "detailed" | "timeseries" (default: "summary")
 *
 * Returns:
 * {
 *   totalRequests: 10537,
 *   successRate: "99.2%",
 *   p95Latency: "47ms",
 *   healthStatus: "healthy" | "degraded" | "unhealthy",
 *   dlqDepth: 3,
 *   bySource: { text: 7234, voice: 2156, webhook: 1147, ... },
 *   byLane: { GREEN: 9800, YELLOW: 600, RED: 100, BLOCKED: 37 },
 *   circuitStates: { ... }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { omniPort, getMetrics } from "../_shared/omniport.ts";
import { corsHeaders, errorResponse, successResponse } from "../_shared/security-middleware.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const range = url.searchParams.get("range") || "1h";
    const format = url.searchParams.get("format") || "summary";

    // Calculate time range
    const now = new Date();
    let startTime: Date;

    switch (range) {
      case "24h":
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1h":
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize OmniPort
    omniPort.initialize(supabase);

    // Get in-memory metrics (real-time)
    const realtimeMetrics = getMetrics();

    // Get database metrics (historical)
    const { data: dbMetrics, error: dbError } = await supabase.rpc("get_omniport_metrics", {
      p_start_time: startTime.toISOString(),
      p_end_time: now.toISOString(),
    });

    if (dbError) {
      console.warn(`[OmniPort-Metrics] DB query warning: ${dbError.message}`);
    }

    // Merge real-time and historical metrics
    const mergedMetrics = {
      // Prefer real-time for current stats
      totalRequests: realtimeMetrics.totalRequests || dbMetrics?.totalRequests || 0,
      successRate: realtimeMetrics.successRate || dbMetrics?.successRate || "100%",
      p95Latency: realtimeMetrics.p95Latency || dbMetrics?.p95Latency || "0ms",
      healthStatus: realtimeMetrics.healthStatus || dbMetrics?.healthStatus || "healthy",
      dlqDepth: realtimeMetrics.dlqDepth || dbMetrics?.dlqDepth || 0,

      // Source breakdown
      bySource: {
        text: (realtimeMetrics.bySource?.text || 0) + (dbMetrics?.bySource?.text || 0),
        voice: (realtimeMetrics.bySource?.voice || 0) + (dbMetrics?.bySource?.voice || 0),
        webhook: (realtimeMetrics.bySource?.webhook || 0) + (dbMetrics?.bySource?.webhook || 0),
        api: (realtimeMetrics.bySource?.api || 0) + (dbMetrics?.bySource?.api || 0),
        rcs: (realtimeMetrics.bySource?.rcs || 0) + (dbMetrics?.bySource?.rcs || 0),
        whatsapp: (realtimeMetrics.bySource?.whatsapp || 0) + (dbMetrics?.bySource?.whatsapp || 0),
      },

      // Lane breakdown
      byLane: {
        GREEN: (realtimeMetrics.byLane?.GREEN || 0) + (dbMetrics?.byLane?.GREEN || 0),
        YELLOW: (realtimeMetrics.byLane?.YELLOW || 0) + (dbMetrics?.byLane?.YELLOW || 0),
        RED: (realtimeMetrics.byLane?.RED || 0) + (dbMetrics?.byLane?.RED || 0),
        BLOCKED: (realtimeMetrics.byLane?.BLOCKED || 0) + (dbMetrics?.byLane?.BLOCKED || 0),
      },

      // Real-time only
      circuitStates: realtimeMetrics.circuitStates || {},
      uptime: realtimeMetrics.uptime || 0,
      lastReset: realtimeMetrics.lastReset || new Date().toISOString(),

      // Query metadata
      timeRange: {
        start: startTime.toISOString(),
        end: now.toISOString(),
        range,
      },
    };

    // Handle different formats
    if (format === "detailed") {
      // Include additional details
      const { data: dlqEntries } = await supabase
        .from("omniport_dlq")
        .select("id, status, attempts, error_message, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: recentEvents } = await supabase
        .from("omniport_events")
        .select("id, source, risk_lane, risk_score, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      return successResponse({
        ...mergedMetrics,
        dlqEntries: dlqEntries || [],
        recentEvents: recentEvents || [],
      }, 200, requestId);
    }

    if (format === "timeseries") {
      // Return time-bucketed data for charts
      const { data: timeseries } = await supabase
        .from("omniport_metrics")
        .select("*")
        .gte("metric_window", startTime.toISOString())
        .lte("metric_window", now.toISOString())
        .order("metric_window", { ascending: true });

      return successResponse({
        summary: mergedMetrics,
        timeseries: timeseries || [],
      }, 200, requestId);
    }

    // Default: summary format
    return successResponse(mergedMetrics, 200, requestId);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error(`[OmniPort-Metrics] Error (${requestId}): ${message}`);
    return errorResponse(message, 500, requestId);
  }
});
