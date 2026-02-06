import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Shared hook for connecting / configuring integrations via the
 * `integration-connect` Supabase edge function.
 */
export function useIntegrationConnect() {
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async (
    name: string,
    body: Record<string, unknown>,
  ): Promise<boolean> => {
    setIsConnecting(true);

    try {
      if (!supabase) throw new Error('Service unavailable');

      const { data, error } = await supabase.functions.invoke('integration-connect', {
        body,
      });

      if (error) throw error;

      toast.success(data?.message ?? `Successfully connected to ${name}!`);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to connect to ${name}: ${msg}`);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  return { isConnecting, connect };
}
