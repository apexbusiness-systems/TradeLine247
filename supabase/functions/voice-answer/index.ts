import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// SPLIT-ROUTING LOGIC - Dispatcher Pattern Implementation
// =============================================================================

// Test client numbers for development - hardcoded array as requested
// TODO: Replace with database lookup once client database is available
const TEST_CLIENT_NUMBERS = [
  '+14035551234', // Example client 1
  '+14035555678', // Example client 2
  '+15871234567', // Example client 3
];

/**
 * Mock client lookup function - TODO: Connect to real database
 * Returns true if caller is a prospective or existing client
 */
async function isClient(phoneNumber: string): Promise<boolean> {
  // Normalize to E.164 format for comparison
  const normalizedNumber = phoneNumber.replace(/\s+/g, '').replace(/^\+?1?/, '+1');

  // Check against test numbers (mock implementation)
  const isTestClient = TEST_CLIENT_NUMBERS.includes(normalizedNumber);

  console.log(`Identity check: ${phoneNumber} -> ${normalizedNumber} -> ${isTestClient ? 'CLIENT' : 'GENERAL'}`);

  return isTestClient;
}

/**
 * Normalize phone number to E.164 format
 */
function normalizeE164(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;

  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Add +1 prefix if not present (assuming North American numbers)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  // Return as-is if already in E.164 format or unrecognized
  return phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const FORWARD_TARGET_E164 = Deno.env.get('BUSINESS_TARGET_E164');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!TWILIO_AUTH_TOKEN || !FORWARD_TARGET_E164) {
      throw new Error('Missing required environment variables');
    }

    // CRITICAL: Enforce E.164 format for bridge target
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(FORWARD_TARGET_E164)) {
      console.error('CRITICAL: BUSINESS_TARGET_E164 is not in valid E.164 format:', FORWARD_TARGET_E164);
      throw new Error('Invalid bridge target configuration - must be E.164 format');
    }

    // Validate Twilio signature for security
    const twilioSignature = req.headers.get('x-twilio-signature');
    if (!twilioSignature) {
      console.warn('Missing Twilio signature - rejecting request');
      return new Response('Forbidden', { status: 403 });
    }

    // CRITICAL: Validate HMAC signature from Twilio
    const url = new URL(req.url);
    const formData = await req.formData();
    const params: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Build signature validation string
    let signatureString = url.origin + url.pathname;
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      signatureString += key + params[key];
    }

    // Compute expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(TWILIO_AUTH_TOKEN);
    const messageData = encoder.encode(signatureString);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Compare signatures
    if (expectedSignature !== twilioSignature) {
      console.error('Invalid Twilio signature - potential spoofing attempt');
      return new Response('Forbidden - Invalid Signature', { status: 403 });
    }

    console.log('✅ Twilio signature validated successfully');

    // =============================================================================
    // INGEST & NORMALIZE - Phase 1 of Dispatcher Pattern
    // =============================================================================

    // Extract parameters
    const CallSid = params['CallSid'];
    const From = params['From'];
    const To = params['To'];
    const AnsweredBy = params['AnsweredBy']; // AMD result

    // Input validation
    if (!CallSid || !From || !To) {
      console.error('Missing required Twilio parameters');
      return new Response('Bad Request', { status: 400 });
    }

    // Sanitize phone numbers
    if (!e164Regex.test(From) || !e164Regex.test(To)) {
      console.error('Invalid phone number format');
      return new Response('Bad Request', { status: 400 });
    }

    // Normalize From number to E.164 format
    const normalizedFrom = normalizeE164(From);

    console.log('Incoming call:', {
      CallSid,
      From: normalizedFrom,
      To,
      AnsweredBy,
      originalFrom: From
    });

    // =============================================================================
    // IDENTITY RESOLUTION - Phase 2 of Dispatcher Pattern (The Branch)
    // =============================================================================

    // Check if the caller is a "Prospective or Existing Client"
    const callerIsClient = await isClient(normalizedFrom);

    // Get voice config for additional settings
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: config } = await supabase
      .from('voice_config')
      .select('*')
      .single();

    // Create call log with identity information
    await supabase.from('call_logs').insert({
      call_sid: CallSid,
      from_e164: normalizedFrom,
      to_e164: To,
      started_at: new Date().toISOString(),
      status: 'initiated',
      amd_detected: AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep',
      mode: callerIsClient ? 'client_ai' : 'general_hotline',
    });

    // =============================================================================
    // ROUTE DETERMINATION - Dispatcher Pattern Implementation
    // =============================================================================

    let twiml: string;
    let routeSelected: string;

    try {
      if (callerIsClient) {
        // =======================================================================
        // ROUTE A: THE "CLIENT" PATH (AI AGENT)
        // =======================================================================
        routeSelected = 'client_ai';

        console.log(`[${CallSid}] Routing CLIENT to AI Agent`);

        // Check concurrent stream limit (max 10 per org to prevent overload)
        const { count: activeStreams } = await supabase
          .from('voice_stream_logs')
          .select('*', { count: 'exact', head: true })
          .is('connected_at', null)
          .gte('started_at', new Date(Date.now() - 30000).toISOString()); // Last 30s

        const realtimeEnabled = config?.stream_enabled !== false;
        const withinConcurrencyLimit = (activeStreams || 0) < 10;

        if (realtimeEnabled && withinConcurrencyLimit) {
          // Return TwiML to <Connect> to the Media Stream with client type parameter
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to your dedicated support agent.</Say>
  <Connect action="https://${supabaseUrl.replace('https://', '')}/functions/v1/voice-answer?fallback=true">
    <Stream url="wss://${supabaseUrl.replace('https://', '')}/functions/v1/voice-stream?callSid=${CallSid}" />
    <Parameter name="type" value="client" />
  </Connect>
  <Say voice="Polly.Joanna">Connecting you to an agent now.</Say>
  <Dial callerId="${To}" record="record-from-answer" recordingStatusCallback="https://${supabaseUrl.replace('https://', '')}/functions/v1/voice-status">
    <Number>${FORWARD_TARGET_E164}</Number>
  </Dial>
</Response>`;
        } else {
          // Concurrency limit exceeded - fallback to hotline for clients too
          console.warn(`[${CallSid}] CLIENT route: Concurrency limit exceeded (${activeStreams}/10), falling back to hotline`);
          routeSelected = 'client_fallback_hotline';

          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to your dedicated support team.</Say>
  <Dial callerId="${normalizedFrom}" record="record-from-answer" recordingStatusCallback="https://${supabaseUrl.replace('https://', '')}/functions/v1/voice-status">
    <Number>${FORWARD_TARGET_E164}</Number>
  </Dial>
</Response>`;
        }

      } else {
        // =======================================================================
        // ROUTE B: THE "GENERAL" PATH (HOTLINE)
        // =======================================================================
        routeSelected = 'general_hotline';

        console.log(`[${CallSid}] Routing GENERAL caller to hotline`);

        // Return TwiML to <Dial> the Hotline
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring you to the general hotline.</Say>
  <Dial callerId="${normalizedFrom}" record="record-from-answer" recordingStatusCallback="https://${supabaseUrl.replace('https://', '')}/functions/v1/voice-status">
    <Number>${FORWARD_TARGET_E164}</Number>
  </Dial>
</Response>`;
      }

      // Update call log with route information
      await supabase.from('call_logs')
        .update({
          route_selected: routeSelected,
          caller_identity: callerIsClient ? 'client' : 'general',
          normalized_from: normalizedFrom
        })
        .eq('call_sid', CallSid);

    } catch (routingError) {
      // =======================================================================
      // FAIL-SAFE ARCHITECTURE - Voicemail Loop Prevention
      // =======================================================================
      console.error(`[${CallSid}] CRITICAL: Routing error, falling back to hotline:`, routingError);

      // Log the error
      await supabase.from('call_logs')
        .update({
          route_selected: 'error_fallback_hotline',
          error_message: routingError instanceof Error ? routingError.message : 'Unknown routing error',
          fallback_triggered: true
        })
        .eq('call_sid', CallSid);

      // IMMEDIATELY return the TwiML for Route B (Hotline) - NO 500 ERROR
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Transferring you to the general hotline.</Say>
  <Dial callerId="${normalizedFrom}" record="record-from-answer" recordingStatusCallback="https://${supabaseUrl.replace('https://', '')}/functions/v1/voice-status">
    <Number>${FORWARD_TARGET_E164}</Number>
  </Dial>
</Response>`;
    }

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
