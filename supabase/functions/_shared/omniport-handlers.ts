/**
 * OmniPort Handler Registrations
 *
 * Registers destination handlers for different event types.
 * Integrates with existing TradeLine systems (voice, webhooks, MAN mode).
 */

import { omniPort, type CanonicalEvent } from "./omniport.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enterpriseMonitor } from "./enterprise-monitoring.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Initialize all OmniPort handlers
 */
export function initializeOmniPortHandlers(): void {
  const supabase = createClient(supabaseUrl, supabaseKey);
  omniPort.initialize(supabase);

  // Register default handler (text messages)
  omniPort.registerHandler("default", async (event: CanonicalEvent) => {
    console.log(`[OmniPort Handler:default] Processing ${event.id}`);

    // Log to call timeline for audit
    await supabase.from("omniport_events").update({
      processed_at: new Date().toISOString(),
      response_time_ms: Date.now() - event.timestamp,
    }).eq("id", event.id);

    // Emit realtime event for dashboard updates
    await supabase.channel("omniport").send({
      type: "broadcast",
      event: "event_processed",
      payload: {
        eventId: event.id,
        source: event.source,
        lane: event.security.lane,
      },
    });
  });

  // Register voice processor handler
  omniPort.registerHandler("voice-processor", async (event: CanonicalEvent) => {
    console.log(`[OmniPort Handler:voice] Processing voice event ${event.id}`);

    // Voice events are handled by the existing voice-stream pipeline
    // This handler tracks metrics and audit trail

    await supabase.from("call_timeline").insert({
      call_sid: event.traceId,
      event: "omniport_voice_ingress",
      timestamp: new Date().toISOString(),
      metadata: {
        event_id: event.id,
        risk_lane: event.security.lane,
        risk_score: event.security.riskScore,
        content_length: event.payload.content.length,
      },
    }).onConflict("call_sid,event,timestamp").doNothing();

    // Update OmniPort event
    await supabase.from("omniport_events").update({
      processed_at: new Date().toISOString(),
      response_time_ms: Date.now() - event.timestamp,
    }).eq("id", event.id);
  });

  // Register webhook processor handler
  omniPort.registerHandler("webhook-processor", async (event: CanonicalEvent) => {
    console.log(`[OmniPort Handler:webhook] Processing webhook ${event.id}`);

    // Webhook events need to be dispatched to appropriate subsystems
    const metadata = event.payload.metadata as Record<string, unknown> || {};
    const webhookType = metadata.webhook_type as string;

    // Route to appropriate handler based on webhook type
    switch (webhookType) {
      case "twilio":
        // Twilio webhooks (SMS status, recording callbacks)
        await handleTwilioWebhook(event, supabase);
        break;

      case "stripe":
        // Stripe billing webhooks
        await handleStripeWebhook(event, supabase);
        break;

      case "gmail":
        // Gmail push notifications
        await handleGmailWebhook(event, supabase);
        break;

      default:
        // Generic webhook logging
        await supabase.from("analytics_events").insert({
          event_type: "omniport_webhook",
          event_data: {
            event_id: event.id,
            webhook_type: webhookType || "unknown",
            content: event.payload.content.substring(0, 500),
          },
          severity: "info",
        });
    }

    // Update OmniPort event
    await supabase.from("omniport_events").update({
      processed_at: new Date().toISOString(),
      response_time_ms: Date.now() - event.timestamp,
    }).eq("id", event.id);
  });

  // Register MAN mode handler (high-risk events requiring human approval)
  omniPort.registerHandler("man-mode", async (event: CanonicalEvent) => {
    console.log(`[OmniPort Handler:man-mode] Escalating ${event.id} for human review`);

    // Log security event
    await enterpriseMonitor.logSecurityEvent(
      "suspicious_activity",
      {
        event_id: event.id,
        reason: "red_lane_escalation",
        risk_score: event.security.riskScore,
        flags: event.security.flags,
        content_preview: event.payload.content.substring(0, 100),
      },
      event.userId,
      "high"
    );

    // Create MAN mode approval request
    await supabase.from("man_mode_requests").insert({
      event_id: event.id,
      trace_id: event.traceId,
      user_id: event.userId,
      organization_id: event.organizationId,
      request_type: "omniport_escalation",
      content: event.payload.content,
      risk_score: event.security.riskScore,
      security_flags: event.security.flags,
      status: "pending",
      expires_at: new Date(Date.now() + event.routing.ttlMs).toISOString(),
    }).onConflict("event_id").doNothing();

    // Notify via Supabase Realtime
    await supabase.channel("man-mode").send({
      type: "broadcast",
      event: "escalation_required",
      payload: {
        eventId: event.id,
        riskScore: event.security.riskScore,
        flags: event.security.flags,
      },
    });

    // Update OmniPort event
    await supabase.from("omniport_events").update({
      processed_at: new Date().toISOString(),
      destination: "man-mode",
      response_time_ms: Date.now() - event.timestamp,
    }).eq("id", event.id);
  });

  console.log("[OmniPort] All handlers registered");
}

/**
 * Handle Twilio-specific webhooks
 */
async function handleTwilioWebhook(
  event: CanonicalEvent,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const metadata = event.payload.metadata as Record<string, unknown> || {};

  // Log to appropriate table based on event type
  if (metadata.MessageStatus) {
    // SMS status callback
    await supabase.from("sms_status_logs").insert({
      message_sid: metadata.MessageSid as string,
      status: metadata.MessageStatus as string,
      error_code: metadata.ErrorCode as string,
      raw_payload: event.payload.raw,
    }).onConflict("message_sid,status").doNothing();
  }

  if (metadata.CallStatus) {
    // Call status callback
    await supabase.from("call_lifecycle").upsert({
      call_sid: metadata.CallSid as string,
      status: metadata.CallStatus as string,
      duration: metadata.CallDuration as number,
      updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Handle Stripe-specific webhooks
 */
async function handleStripeWebhook(
  event: CanonicalEvent,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const metadata = event.payload.metadata as Record<string, unknown> || {};

  await supabase.from("stripe_webhook_events").insert({
    event_id: metadata.stripe_event_id as string || event.id,
    event_type: metadata.stripe_event_type as string,
    payload: event.payload.raw,
    processed_at: new Date().toISOString(),
  }).onConflict("event_id").doNothing();
}

/**
 * Handle Gmail-specific webhooks
 */
async function handleGmailWebhook(
  event: CanonicalEvent,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const metadata = event.payload.metadata as Record<string, unknown> || {};

  await supabase.from("gmail_sync_queue").insert({
    history_id: metadata.historyId as string,
    email_address: metadata.emailAddress as string,
    omniport_event_id: event.id,
    status: "pending",
  }).onConflict("history_id").doNothing();
}

/**
 * Process OmniPort DLQ entries (call periodically via cron)
 */
export async function processOmniPortDLQ(): Promise<{ processed: number; delivered: number }> {
  return await omniPort.processDLQ();
}

/**
 * Get current OmniPort health status
 */
export function getOmniPortHealth(): { status: string; metrics: Record<string, unknown> } {
  const metrics = omniPort.getMetrics();

  return {
    status: metrics.healthStatus,
    metrics: {
      totalRequests: metrics.totalRequests,
      successRate: metrics.successRate,
      p95Latency: metrics.p95Latency,
      dlqDepth: metrics.dlqDepth,
    },
  };
}

export default initializeOmniPortHandlers;
