import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts"; // Ensure this exists or mock simple validation

serve(async (req) => {
  // 1. SECURITY: Validate Request (Skip in local dev if needed, strictly enforce in Prod)
  // const isValid = await validateTwilioRequest(req); 
  // if (!isValid) return new Response("Forbidden", { status: 403 });

  const { headers } = req;
  const host = headers.get("host") || "";
  const wssUrl = `wss://${host}/functions/v1/voice-stream`;

  // 2. CONTEXT PREPARATION: Trace ID & Caller ID
  // We generate a traceId here to track the entire call lifecycle
  const traceId = crypto.randomUUID();

  console.log(`[Frontdoor] 📞 Call Incoming. Trace: ${traceId} | Handoff -> ${wssUrl}`);

  // 3. TwiML HANDOFF
  // We pass callerNumber and traceId as parameters to the WebSocket
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
      <Say>I am having trouble connecting to the neural core. Please try again.</Say>
    </Response>
  `;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
});
