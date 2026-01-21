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

  // OPENAI REALTIME CONNECTION
  const openAIWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
    ["realtime", `openai-insecure-api-key.${Deno.env.get("OPENAI_API_KEY")}`]
  );

  let streamSid = "";
  let traceId = "";
  let callSid = "";

  // --- OPENAI HANDLERS ---
  openAIWs.onopen = () => {
    console.log(`[Stream] 🔗 OpenAI Connected | Trace: ${traceId}`);
  };

  openAIWs.onerror = (error) => {
    console.error(`[Stream] ❌ OpenAI Error | Trace: ${traceId} | Error:`, error);
  };

  openAIWs.onclose = () => {
    console.log(`[Stream] 🔌 OpenAI Disconnected | Trace: ${traceId}`);
  };

  openAIWs.onmessage = (e) => {
    const response = JSON.parse(e.data);

    // 1. AUDIO FORWARDING (Twilio <- OpenAI)
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
      console.log(`[Stream] 🔧 Tool Triggered | Trace: ${traceId} | Tool: ${response.name} | Args:`, response.arguments);

      // In V3: Execute tool and return output to OpenAI
      // For now: Log for debugging
    }

    // 3. RESPONSE COMPLETION (For debugging latency)
    if (response.type === "response.done") {
      console.log(`[Stream] ✅ Response Complete | Trace: ${traceId}`);
    }

    // 4. ERROR HANDLING
    if (response.type === "error") {
      console.error(`[Stream] ❌ OpenAI Error | Trace: ${traceId} | Error:`, response.error);
    }
  };

  // --- TWILIO HANDLERS ---
  socket.onerror = (error) => {
    console.error(`[Stream] ❌ Twilio Socket Error | Trace: ${traceId} | Error:`, error);
  };

  socket.onclose = () => {
    console.log(`[Stream] 📴 Call Ended | Trace: ${traceId} | CallSid: ${callSid}`);
    if (openAIWs.readyState === WebSocket.OPEN) {
      openAIWs.close();
    }
  };

  socket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      traceId = msg.start.customParameters?.traceId || crypto.randomUUID();
      callSid = msg.start.customParameters?.callSid || "unknown";
      const callerNumber = msg.start.customParameters?.callerNumber || "unknown";

      console.log(`[Stream] 🚀 Call Started | Trace: ${traceId} | Caller: ${callerNumber} | CallSid: ${callSid}`);

      // --- CRITICAL: ZERO-LATENCY CONTEXT LOOKUP ---
      // Query database BEFORE AI speaks to inject personalized context
      let userContext = `Caller Phone: ${callerNumber}. Status: Unknown User.`;
      let clientName = "there";

      try {
        const { data: client, error } = await supabase
          .from("clients")
          .select("first_name, last_name, id")
          .eq("phone", callerNumber)
          .maybeSingle();

        if (client && !error) {
          clientName = client.first_name || "there";
          userContext = `Known Client: ${client.first_name} ${client.last_name} (ID: ${client.id}). Status: PREFERRED CLIENT.`;
          console.log(`[Stream] 👤 Client Identified | Trace: ${traceId} | Client: ${client.first_name} ${client.last_name}`);

          // TODO: Query active tickets/support cases here
          // const { data: tickets } = await supabase
          //   .from("tickets")
          //   .select("id, subject, status")
          //   .eq("client_id", client.id)
          //   .eq("status", "open");
          // if (tickets?.length) {
          //   userContext += `\nActive Tickets: ${tickets.map(t => `#${t.id} - ${t.subject}`).join(", ")}`;
          // }
        } else {
          console.log(`[Stream] 🆕 New Caller | Trace: ${traceId} | Phone: ${callerNumber}`);
        }
      } catch (error) {
        console.error(`[Stream] ⚠️ Context Lookup Failed | Trace: ${traceId} | Error:`, error);
        // Continue with default context - don't block the call
      }

      // --- SESSION CONFIGURATION WITH DYNAMIC CONTEXT ---
      const sessionConfig = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          voice: "shimmer",
          // CRITICAL: Inject live context into instructions
          instructions: `${ADELINE_PROMPT}\n\n## LIVE CONTEXT\n${userContext}\n\nGreet the caller as "${clientName}".`,

          // LATENCY TUNING: Optimized for human-like conversation
          turn_detection: {
            type: "server_vad",
            threshold: 0.6,              // Higher = Less sensitive (fewer false interruptions)
            prefix_padding_ms: 300,      // Audio before speech to include
            silence_duration_ms: 400     // Snappy response (lower = faster, but may cut off)
          },

          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",

          // Temperature for response generation
          temperature: 0.7,
          max_response_output_tokens: 150  // Keep responses concise
        },
      };

      if (openAIWs.readyState === WebSocket.OPEN) {
        openAIWs.send(JSON.stringify(sessionConfig));
        console.log(`[Stream] ⚙️ Session Configured | Trace: ${traceId}`);

        // Force AI to speak first with personalized greeting
        openAIWs.send(JSON.stringify({ type: "response.create" }));
        console.log(`[Stream] 🎙️ Greeting Triggered | Trace: ${traceId}`);
      } else {
        console.error(`[Stream] ❌ OpenAI not ready | Trace: ${traceId} | State: ${openAIWs.readyState}`);
      }
    }

    // Forward audio from Twilio to OpenAI
    if (msg.event === "media" && openAIWs.readyState === WebSocket.OPEN) {
      openAIWs.send(JSON.stringify({
        type: "input_audio_buffer.append",
        audio: msg.media.payload,
      }));
    }

    // Handle stream stop
    if (msg.event === "stop") {
      console.log(`[Stream] 🛑 Stream Stopped | Trace: ${traceId}`);
    }
  };

  return response;
});
