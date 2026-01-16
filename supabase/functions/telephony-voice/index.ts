import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { twiml } from "npm:twilio";

serve(async (req) => {
  try {
    // 1. Configuration Validation
    const railwayDomain = Deno.env.get("RAILWAY_PUBLIC_DOMAIN");
    if (!railwayDomain) {
      throw new Error("CRITICAL: RAILWAY_PUBLIC_DOMAIN environment variable is missing.");
    }

    // 2. Parse Twilio Request
    // Twilio sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const callerNumber = formData.get("Caller")?.toString() || "Unknown";

    // 3. TwiML Generation
    const response = new twiml.VoiceResponse();

    // The Greeting
    response.say({
      voice: "Polly.Joanna-Neural",
      language: "en-US"
    }, "Thank you for calling TradeLine 24/7. I am your AI concierge. How can I help you today?");

    // The Handoff
    const connect = response.connect();
    const stream = connect.stream({
      url: `wss://${railwayDomain}/media-stream`,
      statusCallback: `https://${railwayDomain}/voice-status`,
      statusCallbackEvent: "completed",
    });

    // Custom Parameter
    stream.parameter({
      name: "caller_number",
      value: callerNumber
    });

    // 4. Output
    return new Response(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("Error processing telephony-voice request:", error);

    // Return a fallback TwiML or error message if something critical fails
    // For now, we return 500 to alert Twilio's debugger
    return new Response(String(error), { status: 500 });
  }
});
