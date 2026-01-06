import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // RESEARCH IMPLEMENTATION: Edge-Side TwiML
  // We skip heavy DB lookups here to minimize PDD (Post-Dial Delay).
  
  const xml = `
  <Response>
    <Connect>
      <Stream url="wss://${req.headers.get("host")}/functions/v1/voice-stream" />
    </Connect>
  </Response>`;

  return new Response(xml, {
    headers: { 
      "Content-Type": "text/xml",
      "Cache-Control": "no-cache" // Ensure Twilio doesn't cache stale TwiML
    },
  });
});
