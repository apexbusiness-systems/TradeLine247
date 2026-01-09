 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    // Check secrets (names only)
    const secrets = {
      TWILIO_ACCOUNT_SID: !!Deno.env.get('TWILIO_ACCOUNT_SID'),
      TWILIO_AUTH_TOKEN: !!Deno.env.get('TWILIO_AUTH_TOKEN'),
      TWILIO_API_KEY: !!Deno.env.get('TWILIO_API_KEY'),
      TWILIO_API_SECRET: !!Deno.env.get('TWILIO_API_SECRET'),
      OPENAI_API_KEY: !!Deno.env.get('OPENAI_API_KEY'),
      BUSINESS_TARGET_E164: !!Deno.env.get('BUSINESS_TARGET_E164'),
    };

    // Get active Twilio numbers
    const { data: twilioNumbers } = await supabase
      .from('twilio_numbers')
      .select('*')
      .eq('active', true);

    // Get voice config
    const { data: voiceConfig } = await supabase
      .from('voice_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    // Get recent webhook stats (last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: recentCalls } = await supabase
      .from('call_logs')
      .select('status, created_at')
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(100);

    const webhookStats = {
      success_2xx: recentCalls?.filter(c => c.status === 'completed' || c.status === 'in-progress').length || 0,
      error_4xx: recentCalls?.filter(c => c.status === 'failed').length || 0,
      error_5xx: 0,
      total: recentCalls?.length || 0,
    };

    // Get enhanced voice metrics (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: voiceStreamMetrics } = await supabase
      .from('voice_stream_logs')
      .select(`
        twilio_start_ms,
        openai_connect_ms,
        first_byte_latency_ms,
        message_count,
        silence_nudges,
        elapsed_ms,
        fell_back,
        started_at
      `)
      .gte('started_at', twentyFourHoursAgo)
      .order('started_at', { ascending: false })
      .limit(1000);

    // Calculate enhanced metrics
    const voiceMetrics = {
      handshake_latency: {
        avg_ms: 0,
        p50_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
        count: 0
      },
      first_byte_latency: {
        avg_ms: 0,
        p50_ms: 0,
        p95_ms: 0,
        p99_ms: 0,
        count: 0
      },
      message_throughput: {
        avg_per_call: 0,
        total_messages: 0,
        total_calls: 0
      },
      silence_nudges: {
        avg_per_call: 0,
        total_nudges: 0,
        frequency_per_minute: 0
      },
      fallback_rate: 0,
      total_streams: voiceStreamMetrics?.length || 0
    };

    if (voiceStreamMetrics && voiceStreamMetrics.length > 0) {
      // Calculate handshake latencies (twilio to openai connection)
      const handshakeLatencies = voiceStreamMetrics
        .filter(m => m.twilio_start_ms && m.openai_connect_ms)
        .map(m => m.openai_connect_ms! - m.twilio_start_ms!)
        .filter(latency => latency > 0 && latency < 30000); // Filter reasonable latencies

      if (handshakeLatencies.length > 0) {
        handshakeLatencies.sort((a, b) => a - b);
        voiceMetrics.handshake_latency = {
          avg_ms: Math.round(handshakeLatencies.reduce((a, b) => a + b, 0) / handshakeLatencies.length),
          p50_ms: handshakeLatencies[Math.floor(handshakeLatencies.length * 0.5)],
          p95_ms: handshakeLatencies[Math.floor(handshakeLatencies.length * 0.95)],
          p99_ms: handshakeLatencies[Math.floor(handshakeLatencies.length * 0.99)],
          count: handshakeLatencies.length
        };
      }

      // Calculate first-byte latencies
      const firstByteLatencies = voiceStreamMetrics
        .filter(m => m.first_byte_latency_ms)
        .map(m => m.first_byte_latency_ms!)
        .filter(latency => latency > 0 && latency < 10000); // Filter reasonable latencies

      if (firstByteLatencies.length > 0) {
        firstByteLatencies.sort((a, b) => a - b);
        voiceMetrics.first_byte_latency = {
          avg_ms: Math.round(firstByteLatencies.reduce((a, b) => a + b, 0) / firstByteLatencies.length),
          p50_ms: firstByteLatencies[Math.floor(firstByteLatencies.length * 0.5)],
          p95_ms: firstByteLatencies[Math.floor(firstByteLatencies.length * 0.95)],
          p99_ms: firstByteLatencies[Math.floor(firstByteLatencies.length * 0.99)],
          count: firstByteLatencies.length
        };
      }

      // Calculate message throughput
      const callsWithMessages = voiceStreamMetrics.filter(m => m.message_count);
      if (callsWithMessages.length > 0) {
        const totalMessages = callsWithMessages.reduce((sum, m) => sum + (m.message_count || 0), 0);
        voiceMetrics.message_throughput = {
          avg_per_call: Math.round(totalMessages / callsWithMessages.length),
          total_messages: totalMessages,
          total_calls: callsWithMessages.length
        };
      }

      // Calculate silence nudge metrics
      const callsWithNudges = voiceStreamMetrics.filter(m => (m.silence_nudges || 0) > 0);
      if (callsWithNudges.length > 0) {
        const totalNudges = callsWithNudges.reduce((sum, m) => sum + (m.silence_nudges || 0), 0);
        const avgCallDurationMinutes = 5; // Assume 5 minute average call duration for frequency calc
        voiceMetrics.silence_nudges = {
          avg_per_call: Math.round(totalNudges / callsWithNudges.length * 10) / 10,
          total_nudges: totalNudges,
          frequency_per_minute: Math.round(totalNudges / (callsWithNudges.length * avgCallDurationMinutes) * 10) / 10
        };
      }

      // Calculate fallback rate
      const totalStreams = voiceStreamMetrics.length;
      const fallbackStreams = voiceStreamMetrics.filter(m => m.fell_back).length;
      voiceMetrics.fallback_rate = totalStreams > 0 ? Math.round((fallbackStreams / totalStreams) * 1000) / 10 : 0; // Percentage with 1 decimal
    }

    // Calculate rings to seconds
    const ringsToSeconds = (voiceConfig?.pickup_rings || 3) * 6; // ~6s per ring

    const health = {
      secrets,
      twilioNumbers: twilioNumbers || [],
      webhookUrls: {
        staging: {
          voice_answer: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-answer`,
          voice_status: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-status`,
          voice_consent: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-consent`,
        },
        production: {
          voice_answer: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-answer`,
          voice_status: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-status`,
          voice_consent: `${Deno.env.get('SUPABASE_URL')}/functions/v1/voice-consent`,
        },
      },
      config: {
        pickup_mode: voiceConfig?.pickup_mode || 'after_rings',
        pickup_rings: voiceConfig?.pickup_rings || 3,
        pickup_seconds: ringsToSeconds,
        panic_mode: voiceConfig?.panic_mode || false,
        llm_enabled: voiceConfig?.llm_enabled !== false,
      },
      webhookStats,
      voiceMetrics,
      lastCheck: new Date().toISOString(),
    };

    return new Response(JSON.stringify(health), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Voice health check error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

