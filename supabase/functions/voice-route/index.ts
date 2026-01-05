 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOTLINE_NUMBER_E164 = '+15877428885';
const HOTLINE_NUMBER_DIAL = '5877428885';

function normalizeToE164(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) {
    const sanitized = trimmed.replace(/[^\d+]/g, '');
    return /^\+[1-9]\d{1,14}$/.test(sanitized) ? sanitized : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

async function isClient(phoneNumber: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('e164', phoneNumber)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Client lookup error:', error);
    return false;
  }

  return !!data;
}

function twimlHotline(callerId: string | null): string {
  const safeCallerId = callerId || HOTLINE_NUMBER_E164;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to our hotline.</Say>
  <Dial callerId="${safeCallerId}">${HOTLINE_NUMBER_DIAL}</Dial>
</Response>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Validate Twilio signature and get params
    const params = await validateTwilioRequest(req, url.toString());
    const fromRaw = params.From || '';
    const normalizedFrom = normalizeToE164(fromRaw);

    const timeoutMs = 1000;
    const isClientPromise = normalizedFrom ? isClient(normalizedFrom) : Promise.resolve(false);
    const clientValidated = await Promise.race([
      isClientPromise,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);

    if (!clientValidated) {
      const twiml = twimlHotline(normalizedFrom);
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    const dynamicHost = url.host;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${dynamicHost}/stream">
      <Parameter name="customer_type" value="vip" />
    </Stream>
  </Connect>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Voice route error:', error);
    
    const fallbackTwiml = twimlHotline(null);
    return new Response(fallbackTwiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});
