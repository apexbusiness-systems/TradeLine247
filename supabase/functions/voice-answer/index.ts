import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { hostname } = new URL(req.url);
  
  // CRITICAL: Pointing to 'voice-stream' explicitly to prevent drift
  const twiml = `
    <Response>
      <Connect>
        <Stream url="wss://${hostname}/functions/v1/voice-stream" />
      </Connect>
    </Response>
  `;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
});
