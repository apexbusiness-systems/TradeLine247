import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

serve(async (req) => {
  const contentType = req.headers.get("content-type") || "";

  // CASE A: TWILIO STATUS CALLBACK (Form Data)
  // Configured in Twilio Console: "Call Status Changes" -> Point to this URL
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    const callStatus = formData.get("CallStatus");
    const callSid = formData.get("CallSid");
    const caller = formData.get("Caller");

    console.log(`[Call Status] ${callSid}: ${callStatus}`);

    // RECOVERY LOGIC: If call failed or dropped, send SMS
    if (callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer") {
      console.log(`[Recovery] ⚠️ Initiating SMS Recovery for ${caller}`);
      // Trigger internal send-sms logic here
      // await supabase.functions.invoke('send-sms', { body: { to: caller, type: 'recovery' } })
    }
    return new Response("OK");
  }

  // CASE B: AI TOOL CALL (JSON)
  // OpenAI calls this via 'fetch' to execute business logic
  if (contentType.includes("application/json")) {
    const { action, params } = await req.json();
    console.log(`[Tool Exec] ${action}`, params);

    if (action === "check_schedule") {
      // Mock DB check
      return new Response(JSON.stringify({
        status: "success",
        available: true,
        slot: "2pm",
        script: "I have a 2 PM slot open. Shall I book it?" // "Closed Loop" Scripting
      }), { headers: { "Content-Type": "application/json" } });
    }
  }

  return new Response("Unknown Request Type", { status: 400 });
});
