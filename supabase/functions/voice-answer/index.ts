
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts";
import { buildInternalNumberSet, isInternalCaller, safeDialTarget } from "../_shared/antiLoop.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FORWARD_TARGET_E164 = Deno.env.get('BUSINESS_TARGET_E164');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!FORWARD_TARGET_E164) {
      throw new Error('Missing required environment variables');
    }

    // Clone request for validation since it consumes body
    const reqClone = req.clone();
    const url = new URL(req.url);

    let params: Record<string, string>;
    try {
      params = await validateTwilioRequest(reqClone, url.toString());
    } catch (e) {
      console.error('Twilio validation failed in voice-answer:', e);
      return new Response('Forbidden', { status: 403 });
    }

    // Extract parameters from validator response
    const CallSid = params['CallSid'];
    const From = params['From'];
    const To = params['To'];
    const AnsweredBy = params['AnsweredBy'];

    console.log('Incoming call (New Flow):', { CallSid, From, To, AnsweredBy });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create call log (idempotent by call_sid unique constraint)
    const now = new Date().toISOString();
    
    // Initialize call log with Adeline as start
    const { error: insertError } = await supabase.from('call_logs').upsert({
      call_sid: CallSid,
      from_e164: From,
      to_e164: To,
      started_at: now,
      status: 'in-progress',
      current_stage: 'Adeline',
      agent_history: { Adeline: [] }, // Empty history to start
      mode: 'llm', // New AI mode
      call_reason: '',
      caller_name: '',
      caller_email: ''
    }, { onConflict: 'call_sid' });

    if (insertError) {
      console.error('Failed to create/update call log:', insertError);
    }
    
    // Log timeline
    await supabase.from('call_timeline').insert({
      call_sid: CallSid,
      event: 'inbound_received_new_flow',
      timestamp: now,
      metadata: { from: From, to: To }
    });

    const greeting = "Thank you for calling TradeLine 24/7, this is Adeline. How can I help you today?";
    
    await supabase.from('call_logs').update({
        agent_history: {
            Adeline: [{ role: "assistant", content: greeting }]
        }
    }).eq('call_sid', CallSid);

    const dispatcherUrl = `${url.origin}/functions/v1/dispatcher`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Gather input="speech" action="${dispatcherUrl}" method="POST" timeout="2">
  </Gather>
  <Say voice="Polly.Joanna">Are you still there?</Say>
  <Redirect method="POST">${dispatcherUrl}</Redirect>
</Response>`;

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('Error handling call:', error);
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're sorry, but we're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});
