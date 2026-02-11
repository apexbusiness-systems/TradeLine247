import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts";

serve(async (req) => {
  // 1. SECURITY (Production Guardrail)
  // Validate Twilio signature to prevent spoofing attacks
  // Validate Twilio signature to prevent spoofing attacks
  const url = new URL(req.url);
  const fullUrl = `${url.protocol}//${url.host}${url.pathname}${url.search}`;

  try {
    await validateTwilioRequest(req, fullUrl);
  } catch (error) {
    console.error(`[Frontdoor] ❌ Security validation failed: ${error}`);
    return new Response("Forbidden", { status: 403 });
  }

  const { headers } = req;
  const host = headers.get("host") || "";
  const wssUrl = `wss://${host}/functions/v1/voice-stream`;

  // 2. CONTEXT PREPARATION: Trace ID & Caller ID
  // Generate a traceId to track the entire call lifecycle
  const traceId = crypto.randomUUID();

  console.log(`[Frontdoor] 📞 Call Incoming. Trace: ${traceId} | Handoff -> ${wssUrl}`);

  // 3. TwiML HANDOFF WITH CONTEXT
  // Pass caller identity directly into stream parameters for zero-latency lookup
  const twiml = `
    <Response>
      <Connect>
        <Stream url="${wssUrl}">
          <Parameter name="traceId" value="${traceId}" />
          <Parameter name="callerNumber" value="{{Call.From}}" />
          <Parameter name="callSid" value="{{CallSid}}" />
        </Stream>
      </Connect>
      <Pause length="1" />
      <Say>Sorry, we are experiencing a temporary connection issue. I have sent you a text message to help you right away.</Say>
    </Response>
  `;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
});
