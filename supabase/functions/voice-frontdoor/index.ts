import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateRequest } from "https://esm.sh/twilio@4.23.0/lib/webhooks/webhooks.js";

console.log("🚀 Voice Frontdoor Loaded - Fail-Open Mode");

serve(async (req) => {
  try {
    // Log everything for debugging
    const url = new URL(req.url);
    console.log(`📞 INCOMING: ${req.method} ${url.toString()}`);
    console.log(`📋 HEADERS: Host=${req.headers.get("host")}, Proto=${url.protocol}, Sig=${!!req.headers.get("x-twilio-signature")}`);

    // Health check
    if (req.method === "GET") {
      return new Response(JSON.stringify({ 
        status: "active", 
        service: "voice-frontdoor",
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200
      });
    }

    // Check auth token
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) {
      throw new Error("FATAL: No TWILIO_AUTH_TOKEN in env");
    }

    // Parse body safely
    const bodyText = await req.text();
    console.log(`📄 Body Length: ${bodyText.length} chars`);
    
    let params: Record<string, string> = {};
    if (bodyText && req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
      const urlParams = new URLSearchParams(bodyText);
      urlParams.forEach((val, key) => params[key] = val);
      console.log(`📊 Parsed Params: ${Object.keys(params).join(", ")}`);
    } else {
      console.log("⚠️ No URL-encoded body or content-type mismatch");
    }

    // Validate Twilio request (but don't block on failure)
    try {
      const twilioSignature = req.headers.get("x-twilio-signature") || "";
      const isValid = validateRequest(authToken, twilioSignature, url.toString(), params);
      if (!isValid) {
        console.log("⚠️  Twilio validation failed - continuing in fail-open mode");
        console.log(`  Expected URL: ${url.toString()}`);
        console.log(`  Actual Sig: ${twilioSignature}`);
      } else {
        console.log("✅ Twilio Signature Validated");
      }
    } catch (validationError) {
      console.log("⚠️  Validation process error - continuing in fail-open mode");
    }

    // SUCCESS - Return TwiML
    const twiml = `
      <Response>
        <Say voice="alice">Tradeline 247 Systems Online.</Say>
        <Say>Hotline is active. Implement your business logic here.</Say>
      </Response>
    `;

    console.log("✅ Returning Success TwiML");
    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
      status: 200,
    });

  } catch (error) {
    console.error("💥 CRITICAL ERROR:", error);
    
    // FAIL-OPEN: Always return 200 with error message
    const errorTwiml = `
      <Response>
        <Say>System Error.</Say>
        <Say>${error.message.replace(/[^a-zA-Z0-9 ]/g, " ")}</Say>
      </Response>
    `;
    
    return new Response(errorTwiml, {
      headers: { "Content-Type": "text/xml" },
      status: 200
    });
  }
});
