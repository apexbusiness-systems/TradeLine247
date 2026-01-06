import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const formData = await req.formData();
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');
  const callStatus = formData.get('CallStatus');
  const duration = formData.get('CallDuration');

  // Only process completed calls with recordings
  if (callStatus === 'completed' && recordingUrl) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // RESEARCH INTEGRATION: Decoupled Blockchain Anchoring
    // Instead of blocking here to hash the file, we push a task.
    // This allows the webhook to return 200 OK instantly.
    
    try {
      await supabase.from('background_tasks').insert({
        type: 'BLOCKCHAIN_ANCHOR',
        payload: { 
          call_sid: callSid,
          recording_url: recordingUrl,
          duration: duration,
          timestamp: new Date().toISOString(),
          // Metadata for the smart contract
          compliance_tag: 'TRADELINE_VOICE_V1' 
        },
        status: 'pending'
      });
      
      console.log(`[Compliance] Queued blockchain anchor for ${callSid}`);
    } catch (e) {
      console.error('Failed to queue blockchain task:', e);
    }
  }

  return new Response('OK');
});
