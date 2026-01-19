import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { headers } = req;
    const host = headers.get("host") || "";

    // Dynamic Routing for Preview vs Prod
    const wssUrl = `wss://${host}/functions/v1/voice-stream`;

    console.log(`[Frontdoor] 📞 Incoming Call. Handing off to Brain at: ${wssUrl}`);

    // STRICT TwiML Construction
    // We pass Caller and CallSid as Custom Parameters to the Stream.
    // This enables "Context Injection" in the next step.
    const twiml = `
      <Response>
        <Connect>
          <Stream url="${wssUrl}">
            <Parameter name="traceId" value="${crypto.randomUUID()}" />
            <Parameter name="callerNumber" value="{{Call.From}}" />
            <Parameter name="callSid" value="{{CallSid}}" />
          </Stream>
        </Connect>
        <Pause length="2" />
        <Say>We are currently experiencing high call volume. Please leave a message.</Say>
        <Record maxLength="60" action="/functions/v1/voice-recording-callback" />
      </Response>
    `;

    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch (err) {
    console.error("[Frontdoor] 🚨 Critical Failure:", err);
    return new Response("<Response><Say>System Error.</Say></Response>", {
      headers: { "Content-Type": "text/xml" }
    });
  }
});
