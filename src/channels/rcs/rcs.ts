/**
 * RCS Messaging Channel
 *
 * Sends RCS messages via the server-side Supabase Edge Function.
 * All Twilio credential handling occurs server-side — no secrets are
 * exposed to the browser.
 *
 * The edge function `send-rcs` is expected to accept the same
 * payload shape as RcsOutboundPayload and proxy the request to
 * the Twilio Messages API.
 *
 * Feature-gated by FEATURE_RCS (disabled by default).
 */

import { featureFlags } from '@/config/featureFlags';
import { supabase } from '@/integrations/supabase/client';

export interface RcsOutboundPayload {
  to: string;
  body: string;
  mediaUrls?: string[];
  messagingServiceSid: string;
  statusCallbackUrl?: string;
}

export interface RcsMessageResult {
  sid: string;
  status: string;
  to: string;
  dateCreated: string;
}

/**
 * Send an RCS message via the server-side edge function.
 *
 * @throws if the RCS feature flag is disabled
 * @throws if the Supabase client is unavailable
 * @throws if the edge function returns an error
 */
export async function sendRcsMessage(payload: RcsOutboundPayload): Promise<RcsMessageResult> {
  if (!featureFlags.RCS_ENABLED) {
    throw new Error('RCS messaging is disabled by FEATURE_RCS flag');
  }

  const { to, body, mediaUrls, messagingServiceSid, statusCallbackUrl } = payload;

  if (!messagingServiceSid) {
    throw new Error('messagingServiceSid is required for RCS messaging');
  }

  if (!supabase) {
    throw new Error('Supabase client is not available — cannot send RCS message');
  }

  const { data, error } = await supabase.functions.invoke('send-rcs', {
    body: { to, body, mediaUrls, messagingServiceSid, statusCallbackUrl },
  });

  if (error) {
    throw new Error(`RCS send failed: ${error.message}`);
  }

  return data as RcsMessageResult;
}
