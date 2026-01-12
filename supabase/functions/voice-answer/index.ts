import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { VoiceResponse } from "npm:twilio@^4.23.0";

serve(async (req) => {
  const twiml = new VoiceResponse();
  
  // REPLACE THIS with your actual Railway URL
  const railwayUrl = "https://[YOUR-RAILWAY-APP-NAME].up.railway.app/voice-answer";
  
  console.log("Redirecting call to Railway Brain...");
  twiml.redirect(railwayUrl);

  return new Response(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
});
