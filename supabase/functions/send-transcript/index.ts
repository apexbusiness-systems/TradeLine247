
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const maskPII = (text: string): string => {
  if (!text) return text;
  text = text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, user, domain) => {
    return `${user.charAt(0)}***@${domain}`;
  });
  text = text.replace(/(\+?1?\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
  });
  return text;
};

// Helper to generate HTML email content
function generateEmailHtml(callLog: any, orgName: string, started: Date, minutes: number, seconds: number, maskedTranscript: string) {
    // Build summary bullets
    const bullets = [];
    if (callLog.captured_fields?.name) bullets.push(`Name: ${callLog.captured_fields.name}`);
    if (callLog.captured_fields?.callback_number) bullets.push(`Callback: ***-***-${callLog.captured_fields.callback_number.slice(-4)}`);
    if (callLog.captured_fields?.email) bullets.push(`Email: ${maskPII(callLog.captured_fields.email)}`);
    if (callLog.captured_fields?.preferred_time) bullets.push(`Preferred time: ${callLog.captured_fields.preferred_time}`);

    const summary = bullets.length > 0 ? bullets.join('\n• ') : 'No specific details captured';

    return `
        <h2>Call Transcript</h2>
        <p><strong>Caller:</strong> ***-***-${callLog.from_e164.slice(-4)}</p>
        <p><strong>Date:</strong> ${started.toLocaleString()}</p>
        <p><strong>Duration:</strong> ${minutes}m ${seconds}s</p>
        <p><strong>Mode:</strong> ${callLog.mode === 'llm' ? 'AI Assistant' : 'Direct Bridge'}</p>
        ${callLog.handoff ? '<p><strong>⚠️ Transferred to human</strong></p>' : ''}
        ${callLog.urgency ? '<p><strong style="color:red">⚠️ URGENT CALL</strong></p>' : ''}

        <h3>Summary</h3>
        <ul>
          <li>${summary.replace(/\n/g, '</li><li>')}</li>
        </ul>

        <h3>Transcript</h3>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${maskedTranscript}</div>

        <h3>Agent History</h3>
        <pre>${JSON.stringify(callLog.agent_history, null, 2)}</pre>

        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          <strong>Audit Trail JSON:</strong><br>
          <code style="background: #f5f5f5; padding: 10px; display: block; margin-top: 5px; border-radius: 3px; overflow-x: auto;">
            ${JSON.stringify({
              call_sid: callLog.call_sid,
              from: '***-***-' + callLog.from_e164.slice(-4),
              mode: callLog.mode,
              handoff: callLog.handoff,
              captured_fields: callLog.captured_fields,
              started_at: callLog.started_at,
              ended_at: callLog.ended_at
            }, null, 2)}
          </code>
        </p>
      `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const { callSid } = await req.json();
    
    if (!callSid) {
      throw new Error('callSid is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(RESEND_API_KEY);

    // Get call log with organization settings
    const { data: callLog, error: callError } = await supabase
      .from('call_logs')
      .select(`
        *,
        organization:organizations!call_logs_organization_id_fkey (
          name,
          settings
        )
      `)
      .eq('call_sid', callSid)
      .single();

    if (callError || !callLog) {
      throw new Error('Call log not found');
    }

    const transcriptEmail = callLog.organization?.settings?.transcript_email || 'info@tradeline247ai.com';
    const orgName = callLog.organization?.name || 'TradeLine 24/7';

    const isUrgent = callLog.urgency;
    const category = callLog.current_stage || 'Adeline';
    const isLeadOrSupport = category === 'Lisa' || category === 'Christy' || callLog.handoff;

    // Determine recipients
    const toRecipients = [transcriptEmail, 'info@tradeline247ai.com'];

    // Add caller email if present and valid
    if (callLog.caller_email && callLog.caller_email.includes('@')) {
        toRecipients.push(callLog.caller_email);
    }

    // If Urgent or Lead/Support -> Send Immediately
    if (isUrgent || isLeadOrSupport) {
        const started = new Date(callLog.started_at);
        const ended = callLog.ended_at ? new Date(callLog.ended_at) : new Date();
        const durationSeconds = Math.floor((ended.getTime() - started.getTime()) / 1000);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const maskedTranscript = maskPII(callLog.transcript || JSON.stringify(callLog.agent_history) || 'No transcript available');

        const subjectPrefix = isUrgent ? "URGENT: " : "";
        const subject = `${subjectPrefix}Call Transcript: ${callLog.from_e164.slice(-4)} (${started.toLocaleDateString()})`;

        const { error: emailError } = await resend.emails.send({
          from: `${orgName} <transcripts@resend.dev>`,
          to: [...new Set(toRecipients)], // Dedup
          subject: subject,
          html: generateEmailHtml(callLog, orgName, started, minutes, seconds, maskedTranscript),
          tags: isUrgent ? [{ name: 'label', value: 'urgent' }] : []
        });

        if (emailError) throw emailError;
        
        await supabase
          .from('call_logs')
          .update({ transcript_url: 'email-sent-immediate' })
          .eq('call_sid', callSid);

        console.log('✅ Immediate transcript email sent');

    } else {
        // Batching for "Other"
        // Insert into queue
        await supabase.from('transcript_queue').insert({ call_sid: callSid });

        // Check queue size
        const { count } = await supabase.from('transcript_queue').select('*', { count: 'exact', head: true }).eq('processed', false);

        if ((count || 0) >= 50) {
             // Process Batch
             const { data: queueItems } = await supabase.from('transcript_queue').select('call_sid').eq('processed', false).limit(50);
             if (queueItems && queueItems.length > 0) {
                 const sids = queueItems.map(q => q.call_sid);

                 // Fetch all logs
                 const { data: batchLogs } = await supabase.from('call_logs').select('*').in('call_sid', sids);

                 if (batchLogs) {
                     let batchHtml = `<h1>Batch Transcript Report (${batchLogs.length})</h1>`;
                     for (const log of batchLogs) {
                         const started = new Date(log.started_at);
                         batchHtml += `<div style="border-bottom:1px solid #ccc; margin-bottom: 20px; padding-bottom: 10px;">
                            <h3>${log.from_e164} - ${started.toLocaleString()}</h3>
                            <pre>${maskPII(JSON.stringify(log.agent_history || log.transcript, null, 2))}</pre>
                         </div>`;
                     }

                     await resend.emails.send({
                        from: `${orgName} <transcripts@resend.dev>`,
                        to: ['info@tradeline247ai.com'],
                        subject: `[BATCH] 50 Transcripts Report`,
                        html: batchHtml
                     });

                     // Mark processed
                     await supabase.from('transcript_queue').update({ processed: true }).in('call_sid', sids);
                     console.log('✅ Batch transcript email sent');
                 }
             }
        } else {
            console.log(`Queue size: ${count}, waiting for 50`);
        }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending transcript:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
