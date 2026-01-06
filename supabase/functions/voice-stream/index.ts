import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import WebSocket from "https://esm.sh/ws@8.18.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const upgradeHeader = req.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // CRITICAL: Buffer for OpenAI audio before we have a StreamSid
  let streamSid: string | null = null;
  const audioQueue: string[] = [];
  let openAIWs: WebSocket | null = null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  socket.onopen = async () => {
    console.log('Twilio media stream connected');
    
    // Fetch Agent Configuration
    const { data: agentConfig } = await supabase
      .from('telephony_agents')
      .select('system_prompt, voice_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    const instructions = agentConfig?.system_prompt || 
      "You are TradeLine247, a helpful AI financial assistant. Keep responses concise.";
    
    const voice = agentConfig?.voice_id || "alloy";

    try {
      openAIWs = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        {
          headers: {
            "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            "OpenAI-Beta": "realtime=v1"
          }
        }
      );

      openAIWs.on('open', () => {
        console.log('OpenAI Realtime connected');
        
        // 1. Configure Session
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ["text", "audio"],
            instructions: instructions,
            voice: voice,
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        };
        openAIWs?.send(JSON.stringify(sessionUpdate));

        // 2. Trigger Initial Greeting
        const responseCreate = {
          type: 'response.create',
          response: {
            modalities: ["text", "audio"],
            instructions: "Greet the user professionally as TradeLine247."
          }
        };
        openAIWs?.send(JSON.stringify(responseCreate));
      });

      openAIWs.on('message', (data: any) => {
        try {
          const event = JSON.parse(data.toString());
          
          // Handle Audio Output
          if (event.type === 'response.audio.delta' && event.delta) {
            const payload = {
              event: 'media',
              streamSid: streamSid, // Might be null!
              media: { payload: event.delta }
            };

            if (streamSid) {
              socket.send(JSON.stringify(payload));
            } else {
              // BUFFER STRATEGY: Queue packets if StreamSid isn't ready
              audioQueue.push(JSON.stringify(payload));
            }
          }

          // Handle Interruptions
          if (event.type === 'input_audio_buffer.speech_started') {
            socket.send(JSON.stringify({ event: 'clear', streamSid }));
            // Cancel current response in OpenAI
            openAIWs?.send(JSON.stringify({ type: 'response.cancel' }));
          }

        } catch (e) {
          console.error('Error parsing OpenAI message:', e);
        }
      });

      openAIWs.on('close', () => {
        console.log('OpenAI disconnected');
        socket.close();
      });

      openAIWs.on('error', (error: any) => {
        console.error('OpenAI WebSocket Error:', error);
      });

    } catch (err) {
      console.error('Failed to connect to OpenAI:', err);
      socket.close();
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log('Stream started, SID:', streamSid);
        
        // FLUSH QUEUE
        while (audioQueue.length > 0) {
          const bufferedMsg = audioQueue.shift();
          if (bufferedMsg) {
            const parsed = JSON.parse(bufferedMsg);
            parsed.streamSid = streamSid; // Inject SID
            socket.send(JSON.stringify(parsed));
          }
        }
      } else if (data.event === 'media' && openAIWs?.readyState === WebSocket.OPEN) {
        openAIWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: data.media.payload
        }));
      } else if (data.event === 'stop') {
        console.log('Stream stopped');
        openAIWs?.close();
      }
    } catch (e) {
      console.error('Twilio message error:', e);
    }
  };

  socket.onclose = () => {
    openAIWs?.close();
  };

  return response;
});
