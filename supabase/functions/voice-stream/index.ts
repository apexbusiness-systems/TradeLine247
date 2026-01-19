import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ADELINE_PROMPT } from "../_shared/personas.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  // Connect to OpenAI Realtime (The Brain)
  const openAIWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
    ["realtime", `openai-insecure-api-key.${OPENAI_API_KEY}`]
  );

  let streamSid = "";
  let callerInfo = { name: "Valued Customer", hasTicket: false, context: "" };

  // --- OPENAI EVENTS (The Intelligence) ---
  openAIWs.onopen = () => {
    console.log("[OpenAI] 🧠 Connected to Realtime API");
  };

  openAIWs.onmessage = (e) => {
    const response = JSON.parse(e.data);

    // 1. Audio Delta -> Forward to Twilio
    if (response.type === "response.audio.delta" && response.delta) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          event: "media",
          streamSid: streamSid,
          media: { payload: response.delta },
        }));
      }
    }

    // 2. Tool Calls (Function Execution)
    if (response.type === "response.function_call_arguments.done") {
      // Implement Tool Routing Logic here (omitted for brevity, handled in Task 3)
      console.log("[OpenAI] 🛠️ Tool Call Detected:", response.name);
    }
  };

  // --- TWILIO EVENTS (The User) ---
  socket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    switch (msg.event) {
      case "start":
        streamSid = msg.start.streamSid;
        const callerNumber = msg.start.customParameters?.callerNumber || "";
        console.log(`[Twilio] 🌊 Stream Started. Caller: ${callerNumber}`);

        // [CRITICAL] CONTEXT LOOKUP
        // We fetch data BEFORE initializing the OpenAI session to reduce latency.
        const context = await fetchCallerContext(callerNumber);

        // Initialize Session with "Known User" Context
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: "shimmer", // Adeline's Voice
            instructions: `${ADELINE_PROMPT}\n\n[DYNAMIC CONTEXT]\n${context}`,
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500 // Snappy responses (Video 2 Recommendation)
            },
          },
        };
        openAIWs.send(JSON.stringify(sessionConfig));

        // Force First Turn: AI Speaks First based on Context
        openAIWs.send(JSON.stringify({ type: "response.create" }));
        break;

      case "media":
        if (openAIWs.readyState === WebSocket.OPEN) {
          openAIWs.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: msg.media.payload,
          }));
        }
        break;

      case "stop":
        console.log("[Twilio] 🛑 Stream Stopped");
        openAIWs.close();
        break;
    }
  };

  return response;
});

// --- HELPER: INTELLIGENCE RETRIEVAL ---
async function fetchCallerContext(phone: string): Promise<string> {
  if (!phone) return "Caller: Unknown. Treat as new lead.";

  // 1. Identify Client
  const { data: client } = await supabase.from("clients").select("*").eq("phone", phone).single();
  if (!client) return "Caller: New Lead. Ask for name.";

  // 2. Check Active Emergency Tickets
  const { data: tickets } = await supabase
    .from("tickets")
    .select("*")
    .eq("client_id", client.id)
    .in("status", ["open", "urgent"])
    .limit(1);

  let brief = `Caller Identity: ${client.first_name} ${client.last_name}.\n`;
  if (tickets && tickets.length > 0) {
    brief += `⚠️ ACTIVE EMERGENCY FOUND: Ticket #${tickets[0].id} - ${tickets[0].description}.\n`;
    brief += `INSTRUCTION: Do not ask "How can I help?". Instead ask: "Hi ${client.first_name}, are you calling about the ${tickets[0].description}?"`;
  } else {
    brief += `INSTRUCTION: Greet warmly by name. "Hi ${client.first_name}, welcome back to TradeLine."`;
  }

  return brief;
}
