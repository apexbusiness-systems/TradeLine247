 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase config for voice status');
      return new Response(JSON.stringify({ error: 'Server config missing' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrlValue = supabaseUrl as string;
    const supabaseServiceKeyValue = supabaseServiceKey as string;

    const url = new URL(req.url);
    const params = await validateTwilioRequest(req, url.toString());

    // Extract parameters (already parsed above)
    const CallSid = params['CallSid'];
    const CallStatus = params['CallStatus'];
    const CallDuration = params['CallDuration'];
    const From = params['From'];
    const To = params['To'];
    const RecordingUrl = params['RecordingUrl'];

    // Input validation
    if (!CallSid || !CallStatus) {
      console.error('Missing required Twilio parameters');
      return new Response(JSON.stringify({ error: 'Bad Request' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate call status is a known value
    const validStatuses = ['queued', 'ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'canceled', 'failed'];
    if (!validStatuses.includes(CallStatus)) {
      console.error('Invalid call status:', CallStatus);
      return new Response(JSON.stringify({ error: 'Invalid status' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sanitize duration (must be a valid number)
    const duration = parseInt(CallDuration || '0');
    if (isNaN(duration) || duration < 0) {
      console.error('Invalid call duration');
      return new Response(JSON.stringify({ error: 'Invalid duration' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Call status update:', { CallSid, CallStatus, CallDuration });

    // Store in call_lifecycle table for tracking
    const supabase = createClient(supabaseUrlValue, supabaseServiceKeyValue);
    
    const { error: upsertError } = await supabase
      .from('call_lifecycle')
      .upsert({
        call_sid: CallSid,
        from_number: From,
        to_number: To,
        status: CallStatus,
        direction: 'inbound',
        talk_seconds: duration,
        meta: {
          recording_url: RecordingUrl,
          updated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'call_sid'
      });

    if (upsertError) {
      console.error('Error upserting call lifecycle:', upsertError);
    }

    // Log event for analytics
    await supabase.from('analytics_events').insert({
      event_type: 'twilio_call_status',
      event_data: {
        call_sid: CallSid,
        status: CallStatus,
        duration: CallDuration,
        from: From,
        to: To,
        recording_url: RecordingUrl,
        timestamp: new Date().toISOString()
      },
      severity: 'info'
    });

    // Return 200 OK for idempotency
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error processing call status:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

