
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateTwilioRequest } from "../_shared/twilioValidator.ts";
import { AgentFactory } from "../_shared/agentFactory.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clone request for validation since it consumes body
    const reqClone = req.clone();
    const url = new URL(req.url);

    let params: Record<string, string>;
    try {
      params = await validateTwilioRequest(reqClone, url.toString());
    } catch (e) {
      console.error('Validation failed:', e);
      return new Response('Forbidden', { status: 403 });
    }

    // Use params returned from validator (or parse from original request if validator returns params)
    // validateTwilioRequest returns params extracted from body.

    const CallSid = params['CallSid'];
    const SpeechResult = params['SpeechResult'];
    const Digits = params['Digits'];

    if (!CallSid) {
        return new Response('Missing CallSid', { status: 400 });
    }

    // Determine current state
    const { data: callLog, error: fetchError } = await supabase
      .from('call_logs')
      .select('agent_history, current_stage, caller_name, call_reason, caller_email, urgency, retry_count')
      .eq('call_sid', CallSid)
      .single();

    if (fetchError || !callLog) {
       console.error("Call log not found for Sid:", CallSid);
       // Fail safe
       return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Please try again later.</Say><Hangup/></Response>`, {
         headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
       });
    }

    let input = SpeechResult || Digits;

    // Retry Logic for Loop Protection
    if (!input) {
        const currentRetries = (callLog.retry_count || 0) + 1;

        if (currentRetries > 2) {
             const farewell = "I didn't hear anything. Goodbye.";
             await supabase.from('call_logs').update({
                 status: 'completed',
                 ended_at: new Date().toISOString()
             }).eq('call_sid', CallSid);

             return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${farewell}</Say><Hangup/></Response>`, {
                headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
             });
        }

        // Increment retry count
        await supabase.from('call_logs').update({ retry_count: currentRetries }).eq('call_sid', CallSid);
    } else {
        // Reset retry count on valid input
        if (callLog.retry_count > 0) {
            await supabase.from('call_logs').update({ retry_count: 0 }).eq('call_sid', CallSid);
        }
    }

    // Default to Adeline if no history/stage
    let currentAgentName = (callLog.current_stage || "Adeline") as "Adeline" | "Lisa" | "Christy";

    // Fix casing if needed
    if (currentAgentName.toLowerCase() === 'adeline') currentAgentName = "Adeline";
    if (currentAgentName.toLowerCase() === 'lisa') currentAgentName = "Lisa";
    if (currentAgentName.toLowerCase() === 'christy') currentAgentName = "Christy";

    // Instantiate Agent
    const history = callLog.agent_history?.[currentAgentName] || [];
    const agent = await AgentFactory.createAgent(currentAgentName, {
        callSid: CallSid,
        history: history,
        callerName: callLog.caller_name,
        callReason: callLog.call_reason,
        email: callLog.caller_email,
        urgency: callLog.urgency
    });

    if (!input && history.length === 0) {
        input = "Hello";
    } else if (!input) {
        // Just reprompt user if silence (handled by TwiML loop below usually, but here we process logic)
        // If we are here, it means we got a callback with no input (timeout).
        // We shouldn't send empty input to LLM usually, unless we want it to say "Are you there?"
        // But we handled retry count above.
        // Let's ask LLM to prompt again.
        input = "I didn't say anything.";
    }

    const result = await agent.processInput(input);

    let twimlResponse = "";

    // Handle Tool Calls (Transfers / End Call)
    if (result.toolCall) {
        const { name, arguments: args } = result.toolCall;

        if (name === "transfer_to_lisa") {
            // Update DB state
            const handoffContext = args;
            const nextAgent = "Lisa";

            // Generate Greeting
            const greeting = `Hi ${args.caller_name || 'there'}! This is Lisa. I understand you're interested in ${args.specific_interest || 'our services'}. I'm excited to help you with that!`;

            // Log transfer and switch agent
            // We need to initialize Lisa's history with the system prompt (implicit in factory)
            // AND the handoff context message.
            const handoffMsg = { role: "system", content: `[HANDOFF CONTEXT: ${JSON.stringify(handoffContext)}]` };
            const greetingMsg = { role: "assistant", content: greeting };

            const newAgentHistory = [handoffMsg, greetingMsg];

            // Update Adeline's history to show transfer
            const oldAgentHistory = [...history, { role: "user", content: input }, { role: "assistant", content: `[Transferred to Lisa]` }];

            await supabase.from('call_logs').update({
                current_stage: nextAgent,
                caller_name: args.caller_name || callLog.caller_name,
                call_reason: args.call_reason || callLog.call_reason,
                caller_email: args.email || callLog.caller_email,
                urgency: args.urgency || callLog.urgency,
                agent_history: {
                    ...callLog.agent_history,
                    [currentAgentName]: oldAgentHistory,
                    [nextAgent]: newAgentHistory
                }
            }).eq('call_sid', CallSid);

            twimlResponse = `<Say voice="Polly.Joanna">${greeting}</Say>`;

        } else if (name === "transfer_to_christy") {
            const handoffContext = args;
            const nextAgent = "Christy";

            let urgencyPrefix = "";
            if (args.urgency === 'high' || args.caller_emotion === 'angry') {
                urgencyPrefix = "I understand this has been frustrating, and I apologize for the trouble. ";
            }
            const greeting = `Hi ${args.caller_name || 'there'}, this is Christy from support. ${urgencyPrefix}I understand you're experiencing ${args.problem_description || 'an issue'}. I'm going to help you get this resolved.`;

            const handoffMsg = { role: "system", content: `[HANDOFF CONTEXT: ${JSON.stringify(handoffContext)}]` };
            const greetingMsg = { role: "assistant", content: greeting };

            const newAgentHistory = [handoffMsg, greetingMsg];
            const oldAgentHistory = [...history, { role: "user", content: input }, { role: "assistant", content: `[Transferred to Christy]` }];

            await supabase.from('call_logs').update({
                current_stage: nextAgent,
                caller_name: args.caller_name || callLog.caller_name,
                call_reason: args.call_reason || callLog.call_reason,
                caller_email: args.email || callLog.caller_email,
                urgency: (args.urgency === 'high' || args.urgency === true) ? true : callLog.urgency,
                agent_history: {
                    ...callLog.agent_history,
                    [currentAgentName]: oldAgentHistory,
                    [nextAgent]: newAgentHistory
                }
            }).eq('call_sid', CallSid);

            twimlResponse = `<Say voice="Polly.Joanna">${greeting}</Say>`;

        } else if (name === "end_call") {
             // Just Hangup
             const farewell = "Thank you for calling. Goodbye.";
             const oldAgentHistory = [...history, { role: "user", content: input }, { role: "assistant", content: farewell }];

             await supabase.from('call_logs').update({
                 agent_history: {
                     ...callLog.agent_history,
                     [currentAgentName]: oldAgentHistory
                 },
                 status: 'completed',
                 ended_at: new Date().toISOString()
             }).eq('call_sid', CallSid);

             // Trigger transcript generation
             try {
                fetch(`${url.origin}/functions/v1/send-transcript`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || ''},
                    body: JSON.stringify({ callSid: CallSid })
                }); // Async, don't await
             } catch (e) {}

             return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${farewell}</Say><Hangup/></Response>`, {
                headers: { ...corsHeaders, 'Content-Type': 'text/xml' }
             });
        } else {
             // Fallback for unknown tool
             twimlResponse = `<Say voice="Polly.Joanna">One moment please.</Say>`;
        }
    } else {
        // Normal text response
        const newHistory = [
            ...history,
            { role: "user", content: input },
            { role: "assistant", content: result.response }
        ];

        await supabase.from('call_logs').update({
            agent_history: {
                ...callLog.agent_history,
                [currentAgentName]: newHistory
            }
        }).eq('call_sid', CallSid);

        twimlResponse = `<Say voice="Polly.Joanna">${result.response}</Say>`;
    }

    // Construct full TwiML
    // Always Gather after saying something (unless hanging up)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        ${twimlResponse}
        <Gather input="speech" action="${url.origin}/functions/v1/dispatcher" method="POST" timeout="2" speechTimeout="auto">
        </Gather>
        <Say voice="Polly.Joanna">Are you still there?</Say>
        <Redirect method="POST">${url.origin}/functions/v1/dispatcher</Redirect>
    </Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error:', error);
    // Safe fallback
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">We are experiencing technical difficulties. Please try again later.</Say><Hangup/></Response>`, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});
