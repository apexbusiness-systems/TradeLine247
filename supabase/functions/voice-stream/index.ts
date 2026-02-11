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
  let callerNumber = "";

  // --- RECOVERY MECHANISM ---
  const triggerSmsRecovery = async (to: string, trace: string) => {
    console.log(`[Stream] 🛡️ Triggering SMS Safety Net | Trace: ${trace}`);
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to,
          body: "Sorry, we lost connection. How can I help you?"
        })
      });
    } catch (e) {
      console.error(`[Stream] ❌ SMS Failed | Trace: ${trace}`, e);
    }
  };

  // --- OPENAI HANDLERS ---
  openAIWs.onopen = () => {
    console.log(`[Stream] 🔗 OpenAI Connected | Trace: ${traceId}`);
  };

  openAIWs.onerror = (error) => {
    console.error(`[Stream] ❌ OpenAI Error | Trace: ${traceId} | Error:`, error);
  };

  openAIWs.onclose = () => {
    console.log(`[Stream] 🔌 OpenAI Disconnected | Trace: ${traceId}`);
    if (socket.readyState === WebSocket.OPEN) {
      console.error(`[Stream] ⚠️ OpenAI Closed Prematurely | Trace: ${traceId}`);
      if (callerNumber) triggerSmsRecovery(callerNumber, traceId);
      socket.close();
    }
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
      if (socket.readyState === WebSocket.OPEN) {
        if (callerNumber) triggerSmsRecovery(callerNumber, traceId);
        socket.close();
      }
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
      callerNumber = msg.start.customParameters?.callerNumber || "unknown";

      console.log(`[Stream] 🚀 Call Started | Trace: ${traceId} | Caller: ${callerNumber} | CallSid: ${callSid}`);

  // Helper: Connect to OpenAI with timeout fallback
  async function connectToOpenAIWithTimeout(apiKey: string, callSid: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error(`[${sanitizeForLogging(callSid)}] OpenAI connection timeout after ${OPENAI_TIMEOUT_MS}ms`);
        reject(new Error('OpenAI connection timeout'));
      }, OPENAI_TIMEOUT_MS);

      try {
        const startLookup = performance.now();
        const { data: client, error } = await supabase
          .from("clients")
          .select("first_name, last_name, id")
          .eq("phone", callerNumber)
          .maybeSingle();

        if (client && !error) {
          clientName = client.first_name || "there";
          console.log(`[Stream] 👤 Client Identified | Trace: ${traceId} | Client: ${client.first_name} ${client.last_name}`);

          // PARALLEL CONTEXT LOOKUP (Tickets & Bookings) with Strict Timeout
          const dbLookupPromise = Promise.all([
            supabase.from("tickets").select("id, subject, status").eq("client_id", client.id).eq("status", "open").limit(3),
            supabase.from("bookings").select("id, check_in_date, status").eq("client_id", client.id).order("check_in_date", { ascending: false }).limit(3)
          ]);

          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([{ data: [] }, { data: [] }]), 150));

          const [ticketsResult, bookingsResult] = await Promise.race([
            dbLookupPromise,
            timeoutPromise
          ]) as [{ data: any[] | null }, { data: any[] | null }];

          const tickets = ticketsResult.data || [];
          const bookings = bookingsResult.data || [];

          userContext = `Known Client: ${client.first_name} ${client.last_name} (ID: ${client.id}). Status: PREFERRED CLIENT.`;

          if (tickets.length) {
            userContext += `\nOPEN TICKETS: ${tickets.map(t => `#${t.id} (${t.subject})`).join(", ")}`;
          } else {
            userContext += `\nNo open support tickets.`;
          }

        ws.onopen = () => {
          clearTimeout(timeoutId);
          console.log(`[${sanitizeForLogging(callSid)}] ✅ Connected to OpenAI Realtime API`);
          resolve(ws);
        };

        ws.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error(`[${sanitizeForLogging(callSid)}] OpenAI WebSocket connection error:`, sanitizeForLogging(String(error)));
          reject(new Error('OpenAI WebSocket connection failed'));
        };

      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`[${sanitizeForLogging(callSid)}] Failed to create OpenAI WebSocket:`, sanitizeForLogging(String(error)));
        reject(error);
      }
    });
  }

  // Connect to OpenAI Realtime API with timeout handling
  try {
    openaiWs = await connectToOpenAIWithTimeout(OPENAI_API_KEY, callSid);

    openaiWs.onopen = () => {
      openaiConnectTime = Date.now(); // Capture OpenAI connection time
      console.log(`✅ Connected to OpenAI Realtime API (${openaiConnectTime - (twilioStartTime || 0)}ms from Twilio start)`);

      // Build context injection for conversation state preservation
      let contextInjection = '';
      if (Object.keys(conversationState).length > 0) {
        const contextParts = [];
        if (conversationState.caller_name) contextParts.push(`caller name: ${conversationState.caller_name}`);
        if (conversationState.callback_number) contextParts.push(`callback number: ${conversationState.callback_number}`);
        if (conversationState.email) contextParts.push(`email: ${conversationState.email}`);
        if (conversationState.job_summary) contextParts.push(`job summary: ${conversationState.job_summary}`);
        if (conversationState.preferred_datetime) contextParts.push(`preferred time: ${conversationState.preferred_datetime}`);
        if (conversationState.consent_recording !== undefined) contextParts.push(`recording consent: ${conversationState.consent_recording}`);
        if (conversationState.consent_sms_opt_in !== undefined) contextParts.push(`SMS consent: ${conversationState.consent_sms_opt_in}`);
        if (conversationState.call_category) contextParts.push(`call category: ${conversationState.call_category}`);

        if (contextParts.length > 0) {
          contextInjection = `\n\n[CONVERSATION CONTEXT - DO NOT REPEAT TO USER]\nPreviously captured information: ${contextParts.join(', ')}\nUse this context to provide personalized, non-repetitive responses.`;
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
          tools: tools,
          tool_choice: "auto",
        }
      };
      openaiWs.send(JSON.stringify(sessionUpdate));

      // 2. Trigger Greeting: Enable "Voice" (Break Deadlock)
      setTimeout(() => {
        const initialGreeting = {
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: "Say exactly: 'Hello! Thanks for calling TradeLine 24/7. How can I help you secure funding today?'"
          }
        };
        openaiWs.send(JSON.stringify(initialGreeting));
      }, 100); // 100ms buffer ensures session config applies first
    };

    openaiWs.onmessage = (event) => {
      messageCount++; // Increment message counter
      const data = JSON.parse(event.data);
      lastActivityTime = Date.now();

      // Handle different event types
      if (data.type === 'response.audio.delta' && streamSid && twilioSocket.readyState === WebSocket.OPEN) {
        // Capture first AI audio time
        if (firstAIAudioTime === null) {
          firstAIAudioTime = Date.now();
        }
        // Forward audio to Twilio
        twilioSocket.send(JSON.stringify({
          event: 'media',
          streamSid: streamSid,
          media: {
            payload: data.delta
          }
        }));
      } else if (data.type === 'response.audio_transcript.delta') {
        transcript += data.delta;
      } else if (data.type === 'conversation.item.input_audio_buffer.committed') {
        // Capture user speech end time for first-byte latency calculation
        userSpeechEndTime = Date.now();
        // User speech committed - perform safety check (enhanced feature)
        if (data.item?.transcript && safetyConfig) {
          const userText = data.item.transcript;
          userTranscript += userText + ' ';

          // Perform safety check on user input (enforcement-aware)
          try {
            const safetyResult = performSafetyCheck(
              userText,
              safetyConfig,
              {
                duration_seconds: Math.floor((Date.now() - conversationStartTime) / 1000),
                turn_count: turnCount,
                sentiment_history: sentimentHistory
              }
            );

            // Handle safety actions with fail-closed option
            if (!safetyResult.safe) {
              const incidentPayload = {
                call_sid: callSid,
                severity: 'high',
                details: {
                  reason: safetyResult.reason,
                  action: safetyResult.action,
                  confidence: safetyResult.confidence || 0.8,
                  sanitized_text: sanitizeForLogging(userText)
                }
              };

              supabase.from('security_incidents')
                .insert(incidentPayload)
                .then(({ error }) => {
                  if (error) console.error('security_incidents insert error:', error);
                });

              supabase.from('call_logs')
                .update({
                  status: 'terminated_safety',
                  captured_fields: {
                    ...capturedFields,
                    safety_flag: true,
                    safety_escalation_reason: safetyResult.reason,
                    safety_confidence: safetyResult.confidence || 0.8,
                    sentiment_score: safetyResult.sentiment_score
                  }
                })
                .eq('call_sid', callSid)
                .then(({ error }) => {
                  if (error) console.error('Safety flag error:', error);
                });

              if (enforcementMode === 'block') {
                try {
                  twilioSocket.close(1000, 'safety_block');
                  openaiWs?.close(1000, 'safety_block');
                } catch (err) {
                  console.error('Failed to close sockets on safety block:', err);
                }
                return;
              } else {
                console.log(`⚠️ Safety escalation (log mode): ${safetyResult.reason}`);
              }
            }

            // Objection handling (low-latency)
            const objectionType = classifyObjection(userText);
            if (objectionType !== 'none') {
              const context = getObjectionContext(objectionType);
              try {
                openaiWs.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'system',
                    content: [{ type: 'input_text', text: context }]
                  }
                }));
              } catch (err) {
                console.error('Objection injection error:', err);
              }

              supabase.from('call_logs')
                .update({
                  captured_fields: { ...capturedFields, objection_type: objectionType }
                })
                .eq('call_sid', callSid)
                .then(({ error }) => {
                  if (error) console.error('Objection log error:', error);
                });
            }
          } catch (error) {
            // Safety checks should never break the conversation flow
            console.error('Safety check error (non-fatal):', error);
          }
        }
      } else if (data.type === "response.function_call_arguments.done") {
        // Handle Function Calling (Routing) - Merged from Main
        const functionName = data.name;
        const args = JSON.parse(data.arguments);

        console.log(`Tool call detected: ${sanitizeForLogging(functionName)}`, sanitizeForLogging(JSON.stringify(args)));

        if (functionName === "transfer_to_lisa") {
          const context = `[HANDOFF FROM ADELINE]\nCaller: ${args.caller_name || 'Unknown'}\nInterest: ${args.specific_interest}\nReason: ${args.call_reason}\nSentiment: ${args.sentiment}`;
          const newInstructions = `${LISA_PROMPT}\n\n${context}`;

          // Hot Swap to Lisa
          openaiWs.send(JSON.stringify({
            type: "session.update",
            session: {
              instructions: newInstructions,
              voice: "alloy", // Lisa's voice
              tools: [] // Lisa might not need transfer tools, or different ones
            }
          }));

          // Force Greeting
          openaiWs.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Greet the user warmly as Lisa. Mention you understand they are interested in ${args.specific_interest}.`
            }
          }));

        } else if (functionName === "transfer_to_christy") {
          const context = `[HANDOFF FROM ADELINE]\nCaller: ${args.caller_name || 'Unknown'}\nProblem: ${args.problem_description}\nReason: ${args.call_reason}\nUrgency: ${args.urgency}\nEmotion: ${args.caller_emotion}`;
          const newInstructions = `${CHRISTY_PROMPT}\n\n${context}`;

          // Hot Swap to Christy
          openaiWs.send(JSON.stringify({
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
          openaiWs.send(JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Greet the user as Christy from support. ${urgencyNote} Confirm you are ready to help with their issue.`
            }
          }));
        }

      } else if (data.type === 'response.done') {
        turnCount++;
        // Extract captured fields from response
        if (data.response?.output) {
          try {
            const responseOutput = JSON.parse(data.response.output);
            capturedFields = responseOutput;

            // Store captured fields in conversation state for context preservation
            if (responseOutput.caller_name) conversationState.caller_name = responseOutput.caller_name;
            if (responseOutput.callback_number) conversationState.callback_number = responseOutput.callback_number;
            if (responseOutput.email) conversationState.email = responseOutput.email;
            if (responseOutput.job_summary) conversationState.job_summary = responseOutput.job_summary;
            if (responseOutput.preferred_datetime) conversationState.preferred_datetime = responseOutput.preferred_datetime;
            if (responseOutput.consent_recording !== undefined) conversationState.consent_recording = responseOutput.consent_recording;
            if (responseOutput.consent_sms_opt_in !== undefined) conversationState.consent_sms_opt_in = responseOutput.consent_sms_opt_in;
            if (responseOutput.call_category) conversationState.call_category = responseOutput.call_category;
          } catch { }
        }
      } else if (data.type === 'error') {
        console.error('OpenAI error:', sanitizeForLogging(JSON.stringify(data.error)));

        // Fail open: bridge to human
        if (config?.fail_open !== false) {
          twilioSocket.send(JSON.stringify({
            event: 'clear',
            streamSid: streamSid
          }));
        }
      }

      openaiWs.onerror = (error) => {
        console.error('OpenAI WebSocket error:', sanitizeForLogging(String(error)));
      };

      openaiWs.onclose = () => {
        console.log('OpenAI WebSocket closed');
        if (silenceCheckInterval) clearInterval(silenceCheckInterval);
      };
    };

  } catch (error) {
    console.error('Failed to connect to OpenAI:', sanitizeForLogging(String(error)));
    socket.close(1011, 'OpenAI connection failed');
    return response;
  }

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
