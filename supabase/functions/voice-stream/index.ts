import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSystemPrompt } from "../_shared/promptLoader.ts";

serve(async (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const { socket: twilioSocket, response } = Deno.upgradeWebSocket(req);
  const openAIUrl = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

  const openAISocket = new WebSocket(openAIUrl, [
    "realtime",
    `openai-insecure-api-key.${Deno.env.get("OPENAI_API_KEY")}`,
    "openai-beta.realtime-v1",
  ]);

  // Load Personas
  let ADELINE_PROMPT = "";
  let LISA_PROMPT = "";
  let CHRISTY_PROMPT = "";

  // Preload prompts
  try {
    ADELINE_PROMPT = await getSystemPrompt("Adeline");
    LISA_PROMPT = await getSystemPrompt("Lisa");
    CHRISTY_PROMPT = await getSystemPrompt("Christy");
  } catch (e) {
    console.error("Failed to load personas:", e);
    // Fallback if file load fails
    ADELINE_PROMPT = "You are Adeline, the receptionist.";
    LISA_PROMPT = "You are Lisa, sales specialist.";
    CHRISTY_PROMPT = "You are Christy, support specialist.";
  }

  // Definition of tools
  const tools = [
    {
      type: "function",
      name: "transfer_to_lisa",
      description: "Transfer call to Lisa (Sales Specialist) when caller is interested in services, pricing, demos, or new business.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string", description: "Caller's name" },
          call_reason: { type: "string", description: "Brief summary of call reason" },
          specific_interest: { type: "string", description: "What they are interested in" },
          sentiment: { type: "string", description: "Caller's sentiment (e.g. curious, urgent)" }
        },
        required: ["caller_name", "call_reason"]
      }
    },
    {
      type: "function",
      name: "transfer_to_christy",
      description: "Transfer call to Christy (Support Specialist) when caller has technical issues, billing problems, or current account questions.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string", description: "Caller's name" },
          call_reason: { type: "string", description: "Brief summary of issue" },
          problem_description: { type: "string", description: "Details of the problem" },
          urgency: { type: "string", enum: ["low", "medium", "high"], description: "Urgency of the issue" },
          caller_emotion: { type: "string", description: "Emotion (e.g. frustrated, angry, calm)" }
        },
        required: ["caller_name", "call_reason", "urgency"]
      }
    }
  ];

  const cleanup = () => {
    if (openAISocket.readyState === WebSocket.OPEN) openAISocket.close();
    if (twilioSocket.readyState === WebSocket.OPEN) twilioSocket.close();
  };

  twilioSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === "media" && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: data.media.payload,
        }));
      } else if (data.event === "stop") {
        cleanup();
      }
    } catch (e) {
      console.error("Twilio Error:", e);
    }
  };

  openAISocket.onopen = () => {
    console.log("Connected to OpenAI");

    // 1. Initialize Session with Adeline
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: ADELINE_PROMPT,
        voice: "shimmer",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 500 },
        tools: tools,
        tool_choice: "auto",
      },
    };
    openAISocket.send(JSON.stringify(sessionUpdate));

    // 2. Initial Greeting
    const initialGreeting = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "Say 'Hello! This is Adeline from TradeLine 24/7, how can we make your day better?'",
      },
    };
    openAISocket.send(JSON.stringify(initialGreeting));
  };

  openAISocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle Audio Output
      if (data.type === "response.audio.delta" && data.delta && twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.send(JSON.stringify({
          event: "media",
          media: { payload: data.delta },
        }));
      }

      // Handle Function Calling (Routing)
      if (data.type === "response.function_call_arguments.done") {
        const functionName = data.name;
        const args = JSON.parse(data.arguments);

        console.log(`Tool call detected: ${functionName}`, args);

        if (functionName === "transfer_to_lisa") {
          const context = `[HANDOFF FROM ADELINE]\nCaller: ${args.caller_name || 'Unknown'}\nInterest: ${args.specific_interest}\nReason: ${args.call_reason}\nSentiment: ${args.sentiment}`;
          const newInstructions = `${LISA_PROMPT}\n\n${context}`;

          // Hot Swap to Lisa
          openAISocket.send(JSON.stringify({
            type: "session.update",
            session: {
              instructions: newInstructions,
              voice: "alloy", // Lisa's voice
              tools: [] // Lisa might not need transfer tools, or different ones
            }
          }));

          // Force Greeting
          openAISocket.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Greet the user warmly as Lisa. Mention you understand they are interested in ${args.specific_interest}.`
            }
          }));

        } else if (functionName === "transfer_to_christy") {
          const context = `[HANDOFF FROM ADELINE]\nCaller: ${args.caller_name || 'Unknown'}\nProblem: ${args.problem_description}\nReason: ${args.call_reason}\nUrgency: ${args.urgency}\nEmotion: ${args.caller_emotion}`;
          const newInstructions = `${CHRISTY_PROMPT}\n\n${context}`;

          // Hot Swap to Christy
          openAISocket.send(JSON.stringify({
            type: "session.update",
            session: {
              instructions: newInstructions,
              voice: "nova", // Christy's voice
              tools: []
            }
          }));

          // Force Greeting
          let urgencyNote = "";
          if (args.urgency === 'high' || args.caller_emotion === 'angry') {
            urgencyNote = "Acknowledge their frustration immediately and apologize.";
          }
          openAISocket.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Greet the user as Christy from support. ${urgencyNote} Confirm you are ready to help with their issue.`
            }
          }));
        }
      }

    } catch (e) {
      console.error("OpenAI Error:", e);
    }
  };

  openAISocket.onclose = () => cleanup();
  twilioSocket.onclose = () => cleanup();

  return response;
});
