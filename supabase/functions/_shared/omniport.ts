/**
 * OmniPort - Universal Ingress Engine
 *
 * Zero-Trust Gate → Idempotency Wrapper → Semantic Normalization
 * → Risk Classification → Resilient Dispatch → Metrics & Observability
 *
 * Handles text, voice, and webhook inputs with production-grade reliability.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { globalCircuitBreaker } from "./circuitBreaker.ts";
import { enterpriseMonitor } from "./enterprise-monitoring.ts";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Source types for ingress */
export type IngressSource = 'text' | 'voice' | 'webhook' | 'api' | 'rcs' | 'whatsapp';

/** Risk classification lanes */
export type RiskLane = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

/** Health status for metrics */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** DLQ entry status */
export type DLQStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'expired';

/** Canonical Event - normalized format for all inputs */
export interface CanonicalEvent {
  id: string;                      // Idempotency key (FNV-1a hash)
  traceId: string;                 // Request correlation ID
  source: IngressSource;           // Origin channel
  timestamp: number;               // Unix ms
  deviceId?: string;               // Zero-trust device identifier
  userId?: string;                 // Authenticated user
  organizationId?: string;         // Tenant context
  payload: {
    type: 'message' | 'command' | 'event' | 'callback';
    intent?: string;               // Detected intent
    content: string;               // Normalized content
    raw?: unknown;                 // Original payload
    metadata?: Record<string, unknown>;
  };
  security: {
    lane: RiskLane;
    riskScore: number;
    flags: string[];
    validated: boolean;
  };
  routing: {
    destination?: string;          // Target handler
    priority: number;              // 0=highest, 10=lowest
    ttlMs: number;                 // Time-to-live
  };
}

/** Raw input from various sources */
export interface RawIngress {
  source: IngressSource;
  content: string;
  metadata?: Record<string, unknown>;
  deviceId?: string;
  userId?: string;
  organizationId?: string;
  callbackUrl?: string;
  headers?: Record<string, string>;
}

/** OmniPort metrics structure */
export interface OmniPortMetrics {
  totalRequests: number;
  successRate: string;
  p95Latency: string;
  healthStatus: HealthStatus;
  dlqDepth: number;
  bySource: Record<IngressSource, number>;
  byLane: Record<RiskLane, number>;
  circuitStates: Record<string, string>;
  uptime: number;
  lastReset: string;
}

/** DLQ Entry */
export interface DLQEntry {
  id: string;
  event: CanonicalEvent;
  error: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  createdAt: number;
  status: DLQStatus;
}

/** Device Registry Entry */
export interface DeviceEntry {
  deviceId: string;
  organizationId?: string;
  userId?: string;
  fingerprint: string;
  trusted: boolean;
  lastSeen: number;
  riskScore: number;
  capabilities: string[];
}

// ============================================================================
// FNV-1a HASH (Fast idempotency - 32-bit)
// ============================================================================

const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;

/**
 * FNV-1a 32-bit hash - fast idempotency key generation
 * More efficient than SHA-256 for high-throughput deduplication
 */
export function fnv1a(input: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Convert to unsigned 32-bit and hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generate idempotency key from event properties
 */
export function generateIdempotencyKey(
  source: IngressSource,
  content: string,
  deviceId?: string,
  timestamp?: number
): string {
  // Round timestamp to 10-second windows for dedup
  const window = timestamp ? Math.floor(timestamp / 10000) : Math.floor(Date.now() / 10000);
  const data = `${source}:${deviceId || 'anon'}:${window}:${content}`;
  return `omni_${fnv1a(data)}`;
}

// ============================================================================
// OMNIPORT METRICS COLLECTOR (In-Memory + Persistent)
// ============================================================================

interface MetricsState {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  latencies: number[];
  bySource: Record<IngressSource, number>;
  byLane: Record<RiskLane, number>;
  startTime: number;
  lastFlush: number;
}

class MetricsCollector {
  private state: MetricsState;
  private maxLatencySamples = 1000;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): MetricsState {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      latencies: [],
      bySource: { text: 0, voice: 0, webhook: 0, api: 0, rcs: 0, whatsapp: 0 },
      byLane: { GREEN: 0, YELLOW: 0, RED: 0, BLOCKED: 0 },
      startTime: Date.now(),
      lastFlush: Date.now(),
    };
  }

  recordRequest(source: IngressSource, lane: RiskLane, latencyMs: number, success: boolean): void {
    this.state.totalRequests++;
    this.state.bySource[source] = (this.state.bySource[source] || 0) + 1;
    this.state.byLane[lane] = (this.state.byLane[lane] || 0) + 1;

    if (success) {
      this.state.successCount++;
    } else {
      this.state.failureCount++;
    }

    // Rolling window for latency samples
    this.state.latencies.push(latencyMs);
    if (this.state.latencies.length > this.maxLatencySamples) {
      this.state.latencies.shift();
    }
  }

  getP95Latency(): number {
    if (this.state.latencies.length === 0) return 0;
    const sorted = [...this.state.latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || sorted[sorted.length - 1];
  }

  getSuccessRate(): number {
    if (this.state.totalRequests === 0) return 100;
    return (this.state.successCount / this.state.totalRequests) * 100;
  }

  getHealthStatus(): HealthStatus {
    const successRate = this.getSuccessRate();
    const p95 = this.getP95Latency();

    if (successRate >= 99 && p95 < 100) return 'healthy';
    if (successRate >= 95 && p95 < 500) return 'degraded';
    return 'unhealthy';
  }

  getMetrics(dlqDepth: number, circuitStates: Record<string, string>): OmniPortMetrics {
    return {
      totalRequests: this.state.totalRequests,
      successRate: `${this.getSuccessRate().toFixed(1)}%`,
      p95Latency: `${this.getP95Latency()}ms`,
      healthStatus: this.getHealthStatus(),
      dlqDepth,
      bySource: { ...this.state.bySource },
      byLane: { ...this.state.byLane },
      circuitStates,
      uptime: Date.now() - this.state.startTime,
      lastReset: new Date(this.state.startTime).toISOString(),
    };
  }

  reset(): void {
    this.state = this.createInitialState();
  }
}

// ============================================================================
// DEAD LETTER QUEUE (In-Memory + Database Backed)
// ============================================================================

class DeadLetterQueue {
  private queue: Map<string, DLQEntry> = new Map();
  private maxSize = 10000;
  private defaultMaxAttempts = 5;
  private baseRetryMs = 1000;

  async enqueue(
    event: CanonicalEvent,
    error: string,
    supabase?: SupabaseClient
  ): Promise<void> {
    const entry: DLQEntry = {
      id: event.id,
      event,
      error,
      attempts: 1,
      maxAttempts: this.defaultMaxAttempts,
      nextRetryAt: Date.now() + this.calculateBackoff(1),
      createdAt: Date.now(),
      status: 'pending',
    };

    this.queue.set(event.id, entry);

    // Persist to database if available
    if (supabase) {
      try {
        await supabase.from('omniport_dlq').upsert({
          id: entry.id,
          event_data: entry.event,
          error_message: entry.error,
          attempts: entry.attempts,
          max_attempts: entry.maxAttempts,
          next_retry_at: new Date(entry.nextRetryAt).toISOString(),
          status: entry.status,
        });
      } catch (err) {
        console.error('[OmniPort DLQ] Failed to persist entry:', err);
      }
    }

    // Evict oldest if over capacity
    if (this.queue.size > this.maxSize) {
      const oldest = [...this.queue.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) {
        this.queue.delete(oldest[0]);
      }
    }

    console.log(`[OmniPort DLQ] Enqueued ${event.id}: ${error}`);
  }

  async retry(
    id: string,
    handler: (event: CanonicalEvent) => Promise<void>,
    supabase?: SupabaseClient
  ): Promise<boolean> {
    const entry = this.queue.get(id);
    if (!entry) return false;

    entry.attempts++;
    entry.status = 'processing';

    try {
      await handler(entry.event);
      entry.status = 'delivered';
      this.queue.delete(id);

      if (supabase) {
        await supabase.from('omniport_dlq')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', id);
      }

      console.log(`[OmniPort DLQ] Delivered ${id} after ${entry.attempts} attempts`);
      return true;
    } catch (err) {
      if (entry.attempts >= entry.maxAttempts) {
        entry.status = 'failed';
        console.error(`[OmniPort DLQ] Permanently failed ${id} after ${entry.attempts} attempts`);

        if (supabase) {
          await supabase.from('omniport_dlq')
            .update({ status: 'failed', failed_at: new Date().toISOString() })
            .eq('id', id);
        }
      } else {
        entry.status = 'pending';
        entry.nextRetryAt = Date.now() + this.calculateBackoff(entry.attempts);
      }
      return false;
    }
  }

  getRetryable(): DLQEntry[] {
    const now = Date.now();
    return [...this.queue.values()].filter(
      e => e.status === 'pending' && e.nextRetryAt <= now
    );
  }

  getDepth(): number {
    return [...this.queue.values()].filter(
      e => e.status === 'pending' || e.status === 'processing'
    ).length;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter: base * 2^attempt * (0.5-1.5)
    const exponential = this.baseRetryMs * Math.pow(2, attempt);
    const jitter = 0.5 + Math.random();
    return Math.min(exponential * jitter, 300000); // Max 5 minutes
  }
}

// ============================================================================
// DEVICE REGISTRY (Zero-Trust Gate)
// ============================================================================

class DeviceRegistry {
  private cache: Map<string, DeviceEntry> = new Map();
  private cacheTtlMs = 300000; // 5 minutes

  async validate(
    deviceId: string | undefined,
    fingerprint: string,
    supabase?: SupabaseClient
  ): Promise<{ trusted: boolean; riskScore: number; entry?: DeviceEntry }> {
    if (!deviceId) {
      // Anonymous device - assign temporary trust
      return { trusted: true, riskScore: 30 };
    }

    // Check cache
    const cached = this.cache.get(deviceId);
    if (cached && Date.now() - cached.lastSeen < this.cacheTtlMs) {
      return { trusted: cached.trusted, riskScore: cached.riskScore, entry: cached };
    }

    // Check database
    if (supabase) {
      try {
        const { data } = await supabase
          .from('omniport_devices')
          .select('*')
          .eq('device_id', deviceId)
          .single();

        if (data) {
          const entry: DeviceEntry = {
            deviceId: data.device_id,
            organizationId: data.organization_id,
            userId: data.user_id,
            fingerprint: data.fingerprint,
            trusted: data.trusted,
            lastSeen: Date.now(),
            riskScore: data.risk_score || 0,
            capabilities: data.capabilities || [],
          };

          // Verify fingerprint matches
          if (data.fingerprint && data.fingerprint !== fingerprint) {
            console.warn(`[OmniPort] Device fingerprint mismatch: ${deviceId}`);
            entry.riskScore = Math.min(100, entry.riskScore + 50);
            entry.trusted = false;
          }

          this.cache.set(deviceId, entry);
          return { trusted: entry.trusted, riskScore: entry.riskScore, entry };
        }
      } catch (err) {
        console.error('[OmniPort] Device lookup failed:', err);
      }
    }

    // Unknown device - register with default trust
    const newEntry: DeviceEntry = {
      deviceId,
      fingerprint,
      trusted: true,
      lastSeen: Date.now(),
      riskScore: 20,
      capabilities: [],
    };

    this.cache.set(deviceId, newEntry);

    // Persist new device
    if (supabase) {
      try {
        await supabase.from('omniport_devices').upsert({
          device_id: deviceId,
          fingerprint,
          trusted: true,
          risk_score: 20,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[OmniPort] Failed to register device:', err);
      }
    }

    return { trusted: true, riskScore: 20, entry: newEntry };
  }

  async revokeTrust(deviceId: string, supabase?: SupabaseClient): Promise<void> {
    const entry = this.cache.get(deviceId);
    if (entry) {
      entry.trusted = false;
      entry.riskScore = 100;
    }

    if (supabase) {
      await supabase.from('omniport_devices')
        .update({ trusted: false, risk_score: 100, revoked_at: new Date().toISOString() })
        .eq('device_id', deviceId);
    }
  }
}

// ============================================================================
// RISK CLASSIFIER
// ============================================================================

interface RiskPattern {
  pattern: RegExp;
  severity: number;
  lane: RiskLane;
  flag: string;
}

const RISK_PATTERNS: RiskPattern[] = [
  // BLOCKED - Security threats
  { pattern: /(\bUNION\b.*\bSELECT\b|\bDROP\b.*\bTABLE\b)/i, severity: 100, lane: 'BLOCKED', flag: 'sql_injection' },
  { pattern: /<script\b[^>]*>|javascript:/i, severity: 100, lane: 'BLOCKED', flag: 'xss_attempt' },
  { pattern: /\$\{.*\}|\{\{.*\}\}/i, severity: 90, lane: 'BLOCKED', flag: 'template_injection' },

  // RED - High risk, requires human review
  { pattern: /\b(delete|remove|cancel|terminate|refund)\b.*\b(all|everything|account)\b/i, severity: 70, lane: 'RED', flag: 'destructive_intent' },
  { pattern: /\b(transfer|send|wire)\b.*\b(money|funds|\$\d+)\b/i, severity: 75, lane: 'RED', flag: 'financial_action' },
  { pattern: /\b(password|credential|token|secret)\b/i, severity: 60, lane: 'RED', flag: 'sensitive_data' },

  // YELLOW - Medium risk, execute with monitoring
  { pattern: /\b(update|change|modify)\b.*\b(settings|config|profile)\b/i, severity: 40, lane: 'YELLOW', flag: 'config_change' },
  { pattern: /\b(urgent|emergency|asap|immediately)\b/i, severity: 30, lane: 'YELLOW', flag: 'urgency_indicator' },
];

function classifyRisk(content: string, deviceRiskScore: number): { lane: RiskLane; score: number; flags: string[] } {
  const flags: string[] = [];
  let maxSeverity = deviceRiskScore;
  let lane: RiskLane = 'GREEN';

  for (const riskPattern of RISK_PATTERNS) {
    if (riskPattern.pattern.test(content)) {
      flags.push(riskPattern.flag);
      if (riskPattern.severity > maxSeverity) {
        maxSeverity = riskPattern.severity;
        lane = riskPattern.lane;
      }
    }
  }

  // Determine lane from cumulative score
  if (maxSeverity >= 80) lane = 'BLOCKED';
  else if (maxSeverity >= 60) lane = 'RED';
  else if (maxSeverity >= 30) lane = 'YELLOW';
  else lane = 'GREEN';

  return { lane, score: Math.min(100, maxSeverity), flags };
}

// ============================================================================
// CONTENT NORMALIZER
// ============================================================================

function normalizeContent(content: string, source: IngressSource): string {
  let normalized = content;

  // Trim and collapse whitespace
  normalized = normalized.trim().replace(/\s+/g, ' ');

  // Source-specific normalization
  switch (source) {
    case 'voice':
      // Voice transcription cleanup
      normalized = normalized
        .replace(/\buh+\b|\bum+\b|\blike\b/gi, '') // Filler words
        .replace(/\s+/g, ' ')
        .trim();
      break;

    case 'webhook':
      // Preserve structure for webhooks
      break;

    case 'text':
    case 'api':
    case 'rcs':
    case 'whatsapp':
      // Standard text normalization
      normalized = normalized.toLowerCase();
      break;
  }

  return normalized;
}

// ============================================================================
// OMNIPORT ENGINE (Main Class)
// ============================================================================

export class OmniPort {
  private static instance: OmniPort;
  private metrics: MetricsCollector;
  private dlq: DeadLetterQueue;
  private deviceRegistry: DeviceRegistry;
  private idempotencyCache: Map<string, { result: CanonicalEvent; expiresAt: number }>;
  private supabase?: SupabaseClient;
  private handlers: Map<string, (event: CanonicalEvent) => Promise<void>>;

  private constructor() {
    this.metrics = new MetricsCollector();
    this.dlq = new DeadLetterQueue();
    this.deviceRegistry = new DeviceRegistry();
    this.idempotencyCache = new Map();
    this.handlers = new Map();
  }

  static getInstance(): OmniPort {
    if (!OmniPort.instance) {
      OmniPort.instance = new OmniPort();
    }
    return OmniPort.instance;
  }

  /**
   * Initialize OmniPort with Supabase client
   */
  initialize(supabase: SupabaseClient): void {
    this.supabase = supabase;
    console.log('[OmniPort] Initialized with database connection');
  }

  /**
   * Register a handler for a specific destination
   */
  registerHandler(destination: string, handler: (event: CanonicalEvent) => Promise<void>): void {
    this.handlers.set(destination, handler);
    console.log(`[OmniPort] Registered handler: ${destination}`);
  }

  /**
   * Main ingress method - processes all incoming requests
   */
  async ingest(input: RawIngress): Promise<CanonicalEvent> {
    const startTime = Date.now();
    const traceId = crypto.randomUUID();

    try {
      // 1. Generate idempotency key
      const idempotencyKey = generateIdempotencyKey(
        input.source,
        input.content,
        input.deviceId
      );

      // 2. Check idempotency cache
      const cached = this.idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[OmniPort] Duplicate detected: ${idempotencyKey}`);
        return cached.result;
      }

      // 3. Zero-trust device validation
      const deviceFingerprint = this.generateFingerprint(input);
      const deviceValidation = await this.deviceRegistry.validate(
        input.deviceId,
        deviceFingerprint,
        this.supabase
      );

      if (!deviceValidation.trusted) {
        await enterpriseMonitor.logSecurityEvent(
          'suspicious_activity',
          { deviceId: input.deviceId, reason: 'untrusted_device' },
          input.userId,
          'high'
        );
      }

      // 4. Normalize content
      const normalizedContent = normalizeContent(input.content, input.source);

      // 5. Risk classification
      const riskResult = classifyRisk(normalizedContent, deviceValidation.riskScore);

      // 6. Create canonical event
      const event: CanonicalEvent = {
        id: idempotencyKey,
        traceId,
        source: input.source,
        timestamp: Date.now(),
        deviceId: input.deviceId,
        userId: input.userId,
        organizationId: input.organizationId,
        payload: {
          type: this.inferPayloadType(input),
          content: normalizedContent,
          raw: input.metadata,
          metadata: {
            ...input.metadata,
            originalLength: input.content.length,
            normalizedLength: normalizedContent.length,
          },
        },
        security: {
          lane: riskResult.lane,
          riskScore: riskResult.score,
          flags: riskResult.flags,
          validated: deviceValidation.trusted,
        },
        routing: {
          destination: this.determineDestination(input, riskResult.lane),
          priority: this.calculatePriority(riskResult.lane, input.source),
          ttlMs: 300000, // 5 minutes default TTL
        },
      };

      // 7. Handle based on risk lane
      if (riskResult.lane === 'BLOCKED') {
        await this.handleBlocked(event);
        this.metrics.recordRequest(input.source, riskResult.lane, Date.now() - startTime, false);
        throw new Error('Request blocked due to security policy');
      }

      // 8. Cache for idempotency
      this.idempotencyCache.set(idempotencyKey, {
        result: event,
        expiresAt: Date.now() + 60000, // 1 minute cache
      });

      // 9. Dispatch to handler
      await this.dispatch(event);

      // 10. Record metrics
      this.metrics.recordRequest(input.source, riskResult.lane, Date.now() - startTime, true);

      // 11. Persist event
      await this.persistEvent(event);

      console.log(`[OmniPort] Processed ${idempotencyKey} | lane=${riskResult.lane} | ${Date.now() - startTime}ms`);
      return event;

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Record failure
      this.metrics.recordRequest(input.source, 'BLOCKED', latency, false);

      // Log error
      await enterpriseMonitor.logEvent({
        event_type: 'error',
        severity: 'high',
        component: 'omniport',
        operation: 'ingest',
        message: errorMsg,
        metadata: { source: input.source, traceId },
        duration_ms: latency,
      });

      throw error;
    }
  }

  /**
   * Dispatch event to appropriate handler with circuit breaker protection
   */
  private async dispatch(event: CanonicalEvent): Promise<void> {
    const destination = event.routing.destination || 'default';
    const handler = this.handlers.get(destination);

    if (!handler) {
      console.warn(`[OmniPort] No handler for destination: ${destination}`);
      return;
    }

    try {
      await globalCircuitBreaker.execute(destination, async () => {
        await handler(event);
      });
    } catch (error) {
      // Circuit breaker open or handler failed - add to DLQ
      const errorMsg = error instanceof Error ? error.message : 'Dispatch failed';
      await this.dlq.enqueue(event, errorMsg, this.supabase);
      throw error;
    }
  }

  /**
   * Handle blocked requests
   */
  private async handleBlocked(event: CanonicalEvent): Promise<void> {
    await enterpriseMonitor.logSecurityEvent(
      'suspicious_activity',
      {
        event_id: event.id,
        flags: event.security.flags,
        risk_score: event.security.riskScore,
        content_preview: event.payload.content.substring(0, 100),
      },
      event.userId,
      'critical'
    );

    // Optionally revoke device trust for severe violations
    if (event.security.riskScore >= 90 && event.deviceId) {
      await this.deviceRegistry.revokeTrust(event.deviceId, this.supabase);
    }
  }

  /**
   * Persist event to database
   */
  private async persistEvent(event: CanonicalEvent): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('omniport_events').insert({
        id: event.id,
        trace_id: event.traceId,
        source: event.source,
        device_id: event.deviceId,
        user_id: event.userId,
        organization_id: event.organizationId,
        payload_type: event.payload.type,
        content: event.payload.content,
        metadata: event.payload.metadata,
        risk_lane: event.security.lane,
        risk_score: event.security.riskScore,
        security_flags: event.security.flags,
        destination: event.routing.destination,
        priority: event.routing.priority,
      });
    } catch (err) {
      console.error('[OmniPort] Failed to persist event:', err);
    }
  }

  /**
   * Get real-time metrics
   */
  getMetrics(): OmniPortMetrics {
    const circuitStates: Record<string, string> = {};
    for (const dest of this.handlers.keys()) {
      circuitStates[dest] = globalCircuitBreaker.getState(dest);
    }

    return this.metrics.getMetrics(this.dlq.getDepth(), circuitStates);
  }

  /**
   * Process DLQ retries (call periodically)
   */
  async processDLQ(): Promise<{ processed: number; delivered: number }> {
    const retryable = this.dlq.getRetryable();
    let delivered = 0;

    for (const entry of retryable) {
      const handler = this.handlers.get(entry.event.routing.destination || 'default');
      if (handler) {
        const success = await this.dlq.retry(entry.id, handler, this.supabase);
        if (success) delivered++;
      }
    }

    return { processed: retryable.length, delivered };
  }

  /**
   * Generate device fingerprint from request
   */
  private generateFingerprint(input: RawIngress): string {
    const parts = [
      input.headers?.['user-agent'] || '',
      input.headers?.['accept-language'] || '',
      input.source,
    ];
    return fnv1a(parts.join('|'));
  }

  /**
   * Infer payload type from input
   */
  private inferPayloadType(input: RawIngress): 'message' | 'command' | 'event' | 'callback' {
    if (input.callbackUrl) return 'callback';
    if (input.source === 'webhook') return 'event';
    if (input.content.startsWith('/') || input.content.startsWith('!')) return 'command';
    return 'message';
  }

  /**
   * Determine routing destination
   */
  private determineDestination(input: RawIngress, lane: RiskLane): string {
    if (lane === 'RED') return 'man-mode';
    if (input.source === 'voice') return 'voice-processor';
    if (input.source === 'webhook') return 'webhook-processor';
    return 'default';
  }

  /**
   * Calculate priority (0 = highest)
   */
  private calculatePriority(lane: RiskLane, source: IngressSource): number {
    const basePriority: Record<RiskLane, number> = {
      GREEN: 5,
      YELLOW: 3,
      RED: 1,
      BLOCKED: 10,
    };

    const sourceModifier: Record<IngressSource, number> = {
      voice: -1,  // Voice is higher priority
      text: 0,
      webhook: 0,
      api: 0,
      rcs: 0,
      whatsapp: 0,
    };

    return Math.max(0, basePriority[lane] + sourceModifier[source]);
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Get DLQ depth for monitoring
   */
  getDLQDepth(): number {
    return this.dlq.getDepth();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Global OmniPort instance */
export const omniPort = OmniPort.getInstance();

/** Convenience method to get metrics */
export function getMetrics(): OmniPortMetrics {
  return omniPort.getMetrics();
}

/** Quick ingress helper */
export async function ingest(input: RawIngress): Promise<CanonicalEvent> {
  return omniPort.ingest(input);
}

export default omniPort;
