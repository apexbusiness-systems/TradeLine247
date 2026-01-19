import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ADELINE_PROMPT } from "../_shared/personas.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  // OPENAI CONNECTION
  const openAIWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
    ["realtime", `openai-insecure-api-key.${Deno.env.get("OPENAI_API_KEY")}`]
  );

  let streamSid = "";
  let traceId = "";

  // --- OPENAI HANDLERS ---
  openAIWs.onopen = () => console.log("[OpenAI] Connected");

  openAIWs.onmessage = (e) => {
    const response = JSON.parse(e.data);

    // 1. AUDIO FORWARDING
    if (response.type === "response.audio.delta" && response.delta) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          event: "media",
          streamSid: streamSid,
          media: { payload: response.delta },
        }));
      }
    }

    // 2. TOOL CALL HANDLING (The "Closed Loop")
    if (response.type === "response.function_call_arguments.done") {
      console.log(`[Tool] Triggered: ${response.name}`);
      // Logic to trigger 'voice-action' or internal tool execution goes here
      // For V2: We simply log it. In V3, we execute and return output.
    }
  };

  // --- TWILIO HANDLERS ---
  socket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      traceId = msg.start.customParameters?.traceId;
      const callerNumber = msg.start.customParameters?.callerNumber;

      console.log(`[Stream] 🚀 Started. Trace: ${traceId} | Caller: ${callerNumber}`);

      // --- CRITICAL: ZERO-LATENCY CONTEXT LOOKUP ---
      // We assume this caller might be a client. We check BEFORE AI speaks.
      let userContext = `User Phone: ${callerNumber}. Unknown User.`;

      const { data: client } = await supabase
        .from("clients")
        .select("first_name, last_name, id")
        .eq("phone", callerNumber)
        .single();

      if (client) {
        userContext = `User: ${client.first_name} ${client.last_name} (ID: ${client.id}). PREFERRED CLIENT.`;
        // Check for active tickets here...
      }

      // --- SESSION CONFIGURATION ---
      // We inject the context dynamically into the instructions
      const sessionConfig = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          voice: "shimmer",
          instructions: `${ADELINE_PROMPT}\n\n## LIVE CONTEXT\n${userContext}`,
          turn_detection: {
            type: "server_vad",
            threshold: 0.6,         // High threshold = Less Interruptions
            prefix_padding_ms: 300,
            silence_duration_ms: 400 // Snappy Response
          },
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
        },
      };
      if (openAIWs.readyState === WebSocket.OPEN) {
        openAIWs.send(JSON.stringify(sessionConfig));
        // Force AI to speak first
        openAIWs.send(JSON.stringify({ type: "response.create" }));
      }
    }

    if (msg.event === "media" && openAIWs.readyState === WebSocket.OPEN) {
      openAIWs.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: msg.media.payload,
      }));
    }
  };

  return response;
});
