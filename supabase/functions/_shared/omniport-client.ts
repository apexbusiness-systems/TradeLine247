/**
 * OmniPort Client SDK
 *
 * Client integration for connecting TradeLine 24/7 to the OmniPort platform.
 * TradeLine is a CLIENT that sends events TO and fetches metrics FROM OmniPort.
 *
 * Environment Variables Required:
 *   OMNI_PORT_BASE_URL - OmniPort platform base URL
 *   OMNI_PORT_SERVICE_KEY - Service role key for authentication
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TYPES (Matching OmniPort Platform Schema)
// ============================================================================

/** Source types supported by OmniPort */
export type OmniPortSource = 'text' | 'voice' | 'webhook' | 'api' | 'rcs' | 'whatsapp';

/** Risk classification lanes from OmniPort */
export type OmniPortLane = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

/** Health status from OmniPort metrics */
export type OmniPortHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Metrics response from OmniPort.getMetrics() */
export interface OmniPortMetrics {
  totalRequests: number;
  successRate: string;
  p95Latency: string;
  healthStatus: OmniPortHealthStatus;
  dlqDepth: number;
  bySource: Record<OmniPortSource, number>;
  byLane: Record<OmniPortLane, number>;
  circuitStates?: Record<string, string>;
  uptime?: number;
  lastReset?: string;
}

/** Event to send to OmniPort for processing */
export interface OmniPortEvent {
  source: OmniPortSource;
  content: string;
  deviceId?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

/** Response from OmniPort after event ingestion */
export interface OmniPortIngestResponse {
  id: string;
  traceId: string;
  lane: OmniPortLane;
  riskScore: number;
  flags: string[];
  processed: boolean;
}

/** Device registration with OmniPort */
export interface OmniPortDevice {
  deviceId: string;
  fingerprint: string;
  trusted: boolean;
  riskScore: number;
  capabilities?: string[];
}

// ============================================================================
// OMNIPORT CLIENT CLASS
// ============================================================================

export class OmniPortClient {
  private client: SupabaseClient;
  private baseUrl: string;
  private initialized = false;

  constructor() {
    const baseUrl = Deno.env.get("OMNI_PORT_BASE_URL");
    const serviceKey = Deno.env.get("OMNI_PORT_SERVICE_KEY");

    if (!baseUrl || !serviceKey) {
      throw new Error(
        "OmniPort credentials not configured. Set OMNI_PORT_BASE_URL and OMNI_PORT_SERVICE_KEY environment variables."
      );
    }

    this.baseUrl = baseUrl;
    this.client = createClient(baseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.initialized = true;
  }

  /**
   * Check if client is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get real-time metrics from OmniPort platform
   * This fetches the metrics that feed OmniDash dashboards
   */
  async getMetrics(
    timeRange: '1h' | '24h' | '7d' = '1h'
  ): Promise<OmniPortMetrics> {
    try {
      // Call OmniPort's get_omniport_metrics RPC function
      const { data, error } = await this.client.rpc('get_omniport_metrics', {
        p_start_time: this.getStartTime(timeRange),
        p_end_time: new Date().toISOString(),
      });

      if (error) {
        console.error('[OmniPortClient] Metrics fetch error:', error);
        throw new Error(`Failed to fetch OmniPort metrics: ${error.message}`);
      }

      return this.normalizeMetrics(data);
    } catch (err) {
      console.error('[OmniPortClient] getMetrics failed:', err);
      // Return default metrics on error
      return this.getDefaultMetrics();
    }
  }

  /**
   * Send an event to OmniPort for processing
   * OmniPort will validate, classify risk, and route appropriately
   */
  async ingest(event: OmniPortEvent): Promise<OmniPortIngestResponse> {
    try {
      const { data, error } = await this.client
        .from('omniport_events')
        .insert({
          source: event.source,
          content: event.content,
          device_id: event.deviceId,
          user_id: event.userId,
          organization_id: event.organizationId,
          metadata: event.metadata,
          // OmniPort will process and update these fields
          payload_type: 'message',
        })
        .select('id, trace_id, risk_lane, risk_score, security_flags')
        .single();

      if (error) {
        console.error('[OmniPortClient] Ingest error:', error);
        throw new Error(`Failed to ingest event: ${error.message}`);
      }

      return {
        id: data.id,
        traceId: data.trace_id,
        lane: data.risk_lane,
        riskScore: data.risk_score,
        flags: data.security_flags || [],
        processed: true,
      };
    } catch (err) {
      console.error('[OmniPortClient] ingest failed:', err);
      throw err;
    }
  }

  /**
   * Register a device with OmniPort's zero-trust registry
   */
  async registerDevice(
    deviceId: string,
    fingerprint: string,
    organizationId?: string,
    userId?: string
  ): Promise<OmniPortDevice> {
    try {
      const { data, error } = await this.client
        .from('omniport_devices')
        .upsert({
          device_id: deviceId,
          fingerprint,
          organization_id: organizationId,
          user_id: userId,
          trusted: true,
          risk_score: 0,
          last_seen: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[OmniPortClient] Device registration error:', error);
        throw new Error(`Failed to register device: ${error.message}`);
      }

      return {
        deviceId: data.device_id,
        fingerprint: data.fingerprint,
        trusted: data.trusted,
        riskScore: data.risk_score,
        capabilities: data.capabilities,
      };
    } catch (err) {
      console.error('[OmniPortClient] registerDevice failed:', err);
      throw err;
    }
  }

  /**
   * Get device trust status from OmniPort
   */
  async getDeviceTrust(deviceId: string): Promise<OmniPortDevice | null> {
    try {
      const { data, error } = await this.client
        .from('omniport_devices')
        .select('*')
        .eq('device_id', deviceId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw new Error(`Failed to get device: ${error.message}`);
      }

      return {
        deviceId: data.device_id,
        fingerprint: data.fingerprint,
        trusted: data.trusted,
        riskScore: data.risk_score,
        capabilities: data.capabilities,
      };
    } catch (err) {
      console.error('[OmniPortClient] getDeviceTrust failed:', err);
      return null;
    }
  }

  /**
   * Get DLQ depth for monitoring alerts
   */
  async getDLQDepth(): Promise<number> {
    try {
      const { count, error } = await this.client
        .from('omniport_dlq')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('[OmniPortClient] DLQ depth error:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('[OmniPortClient] getDLQDepth failed:', err);
      return 0;
    }
  }

  /**
   * Get recent events for audit/debugging
   */
  async getRecentEvents(
    limit = 20,
    organizationId?: string
  ): Promise<Array<{ id: string; source: string; lane: string; createdAt: string }>> {
    try {
      let query = this.client
        .from('omniport_events')
        .select('id, source, risk_lane, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[OmniPortClient] Recent events error:', error);
        return [];
      }

      return (data || []).map((e) => ({
        id: e.id,
        source: e.source,
        lane: e.risk_lane,
        createdAt: e.created_at,
      }));
    } catch (err) {
      console.error('[OmniPortClient] getRecentEvents failed:', err);
      return [];
    }
  }

  /**
   * Subscribe to real-time OmniPort events (for live dashboard)
   */
  subscribeToEvents(
    callback: (event: { id: string; source: string; lane: string }) => void
  ): { unsubscribe: () => void } {
    const channel = this.client
      .channel('omniport-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'omniport_events' },
        (payload) => {
          callback({
            id: payload.new.id,
            source: payload.new.source,
            lane: payload.new.risk_lane,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getStartTime(range: '1h' | '24h' | '7d'): string {
    const now = new Date();
    switch (range) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '1h':
      default:
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    }
  }

  private normalizeMetrics(data: unknown): OmniPortMetrics {
    if (!data || typeof data !== 'object') {
      return this.getDefaultMetrics();
    }

    const d = data as Record<string, unknown>;
    return {
      totalRequests: Number(d.totalRequests) || 0,
      successRate: String(d.successRate || '100%'),
      p95Latency: String(d.p95Latency || '0ms'),
      healthStatus: (d.healthStatus as OmniPortHealthStatus) || 'healthy',
      dlqDepth: Number(d.dlqDepth) || 0,
      bySource: (d.bySource as Record<OmniPortSource, number>) || {
        text: 0,
        voice: 0,
        webhook: 0,
        api: 0,
        rcs: 0,
        whatsapp: 0,
      },
      byLane: (d.byLane as Record<OmniPortLane, number>) || {
        GREEN: 0,
        YELLOW: 0,
        RED: 0,
        BLOCKED: 0,
      },
      circuitStates: d.circuitStates as Record<string, string>,
      uptime: Number(d.uptime) || 0,
      lastReset: String(d.lastReset || new Date().toISOString()),
    };
  }

  private getDefaultMetrics(): OmniPortMetrics {
    return {
      totalRequests: 0,
      successRate: '100%',
      p95Latency: '0ms',
      healthStatus: 'healthy',
      dlqDepth: 0,
      bySource: { text: 0, voice: 0, webhook: 0, api: 0, rcs: 0, whatsapp: 0 },
      byLane: { GREEN: 0, YELLOW: 0, RED: 0, BLOCKED: 0 },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE & EXPORTS
// ============================================================================

let clientInstance: OmniPortClient | null = null;

/**
 * Get the OmniPort client instance (lazy initialization)
 */
export function getOmniPortClient(): OmniPortClient {
  if (!clientInstance) {
    clientInstance = new OmniPortClient();
  }
  return clientInstance;
}

/**
 * Convenience function to get metrics
 */
export async function getOmniPortMetrics(
  timeRange: '1h' | '24h' | '7d' = '1h'
): Promise<OmniPortMetrics> {
  return getOmniPortClient().getMetrics(timeRange);
}

/**
 * Convenience function to send event
 */
export async function sendToOmniPort(event: OmniPortEvent): Promise<OmniPortIngestResponse> {
  return getOmniPortClient().ingest(event);
}

export default OmniPortClient;
