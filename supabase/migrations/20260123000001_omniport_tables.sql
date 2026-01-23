-- OmniPort Tables Migration
-- Universal Ingress Engine for TradeLine 24/7
-- Supports: Zero-Trust Devices, Events, DLQ, Metrics

-- ============================================================================
-- OMNIPORT DEVICES (Zero-Trust Device Registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS omniport_devices (
  device_id TEXT PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fingerprint TEXT NOT NULL,
  trusted BOOLEAN NOT NULL DEFAULT true,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  capabilities TEXT[] DEFAULT '{}',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for device lookups
CREATE INDEX IF NOT EXISTS idx_omniport_devices_org ON omniport_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_omniport_devices_user ON omniport_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_omniport_devices_trusted ON omniport_devices(trusted) WHERE trusted = true;
CREATE INDEX IF NOT EXISTS idx_omniport_devices_last_seen ON omniport_devices(last_seen DESC);

-- ============================================================================
-- OMNIPORT EVENTS (Canonical Event Log)
-- ============================================================================

CREATE TYPE omniport_source AS ENUM ('text', 'voice', 'webhook', 'api', 'rcs', 'whatsapp');
CREATE TYPE omniport_risk_lane AS ENUM ('GREEN', 'YELLOW', 'RED', 'BLOCKED');
CREATE TYPE omniport_payload_type AS ENUM ('message', 'command', 'event', 'callback');

CREATE TABLE IF NOT EXISTS omniport_events (
  id TEXT PRIMARY KEY,                    -- FNV-1a idempotency key
  trace_id UUID NOT NULL,                 -- Request correlation
  source omniport_source NOT NULL,
  device_id TEXT REFERENCES omniport_devices(device_id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Payload
  payload_type omniport_payload_type NOT NULL DEFAULT 'message',
  content TEXT NOT NULL,
  intent TEXT,
  metadata JSONB DEFAULT '{}',

  -- Security classification
  risk_lane omniport_risk_lane NOT NULL DEFAULT 'GREEN',
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  security_flags TEXT[] DEFAULT '{}',

  -- Routing
  destination TEXT,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),

  -- Processing status
  processed_at TIMESTAMPTZ,
  response_time_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_omniport_events_trace ON omniport_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_omniport_events_source ON omniport_events(source);
CREATE INDEX IF NOT EXISTS idx_omniport_events_org ON omniport_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_omniport_events_user ON omniport_events(user_id);
CREATE INDEX IF NOT EXISTS idx_omniport_events_lane ON omniport_events(risk_lane);
CREATE INDEX IF NOT EXISTS idx_omniport_events_created ON omniport_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_omniport_events_destination ON omniport_events(destination);

-- Partial index for unprocessed events
CREATE INDEX IF NOT EXISTS idx_omniport_events_pending ON omniport_events(created_at)
  WHERE processed_at IS NULL;

-- ============================================================================
-- OMNIPORT DLQ (Dead Letter Queue)
-- ============================================================================

CREATE TYPE omniport_dlq_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'expired');

CREATE TABLE IF NOT EXISTS omniport_dlq (
  id TEXT PRIMARY KEY,                    -- Same as event id
  event_data JSONB NOT NULL,              -- Full canonical event
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL,
  status omniport_dlq_status NOT NULL DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for DLQ processing
CREATE INDEX IF NOT EXISTS idx_omniport_dlq_status ON omniport_dlq(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_omniport_dlq_retry ON omniport_dlq(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_omniport_dlq_created ON omniport_dlq(created_at DESC);

-- ============================================================================
-- OMNIPORT METRICS (Aggregated Metrics for Dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS omniport_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_window TIMESTAMPTZ NOT NULL,     -- 1-minute window start

  -- Request counts
  total_requests INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,

  -- By source
  text_count INTEGER NOT NULL DEFAULT 0,
  voice_count INTEGER NOT NULL DEFAULT 0,
  webhook_count INTEGER NOT NULL DEFAULT 0,
  api_count INTEGER NOT NULL DEFAULT 0,
  rcs_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_count INTEGER NOT NULL DEFAULT 0,

  -- By risk lane
  green_count INTEGER NOT NULL DEFAULT 0,
  yellow_count INTEGER NOT NULL DEFAULT 0,
  red_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,

  -- Latency percentiles (in ms)
  p50_latency INTEGER,
  p95_latency INTEGER,
  p99_latency INTEGER,
  max_latency INTEGER,

  -- DLQ stats
  dlq_depth INTEGER NOT NULL DEFAULT 0,
  dlq_enqueued INTEGER NOT NULL DEFAULT 0,
  dlq_delivered INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(metric_window)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_omniport_metrics_window ON omniport_metrics(metric_window DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to record OmniPort metrics (called periodically)
CREATE OR REPLACE FUNCTION record_omniport_metrics(
  p_window TIMESTAMPTZ,
  p_total INTEGER,
  p_success INTEGER,
  p_failure INTEGER,
  p_by_source JSONB,
  p_by_lane JSONB,
  p_p50 INTEGER,
  p_p95 INTEGER,
  p_p99 INTEGER,
  p_max INTEGER,
  p_dlq_depth INTEGER,
  p_dlq_enqueued INTEGER,
  p_dlq_delivered INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO omniport_metrics (
    metric_window,
    total_requests, success_count, failure_count,
    text_count, voice_count, webhook_count, api_count, rcs_count, whatsapp_count,
    green_count, yellow_count, red_count, blocked_count,
    p50_latency, p95_latency, p99_latency, max_latency,
    dlq_depth, dlq_enqueued, dlq_delivered
  ) VALUES (
    p_window,
    p_total, p_success, p_failure,
    COALESCE((p_by_source->>'text')::INTEGER, 0),
    COALESCE((p_by_source->>'voice')::INTEGER, 0),
    COALESCE((p_by_source->>'webhook')::INTEGER, 0),
    COALESCE((p_by_source->>'api')::INTEGER, 0),
    COALESCE((p_by_source->>'rcs')::INTEGER, 0),
    COALESCE((p_by_source->>'whatsapp')::INTEGER, 0),
    COALESCE((p_by_lane->>'GREEN')::INTEGER, 0),
    COALESCE((p_by_lane->>'YELLOW')::INTEGER, 0),
    COALESCE((p_by_lane->>'RED')::INTEGER, 0),
    COALESCE((p_by_lane->>'BLOCKED')::INTEGER, 0),
    p_p50, p_p95, p_p99, p_max,
    p_dlq_depth, p_dlq_enqueued, p_dlq_delivered
  )
  ON CONFLICT (metric_window) DO UPDATE SET
    total_requests = omniport_metrics.total_requests + p_total,
    success_count = omniport_metrics.success_count + p_success,
    failure_count = omniport_metrics.failure_count + p_failure,
    text_count = omniport_metrics.text_count + COALESCE((p_by_source->>'text')::INTEGER, 0),
    voice_count = omniport_metrics.voice_count + COALESCE((p_by_source->>'voice')::INTEGER, 0),
    webhook_count = omniport_metrics.webhook_count + COALESCE((p_by_source->>'webhook')::INTEGER, 0),
    api_count = omniport_metrics.api_count + COALESCE((p_by_source->>'api')::INTEGER, 0),
    rcs_count = omniport_metrics.rcs_count + COALESCE((p_by_source->>'rcs')::INTEGER, 0),
    whatsapp_count = omniport_metrics.whatsapp_count + COALESCE((p_by_source->>'whatsapp')::INTEGER, 0),
    green_count = omniport_metrics.green_count + COALESCE((p_by_lane->>'GREEN')::INTEGER, 0),
    yellow_count = omniport_metrics.yellow_count + COALESCE((p_by_lane->>'YELLOW')::INTEGER, 0),
    red_count = omniport_metrics.red_count + COALESCE((p_by_lane->>'RED')::INTEGER, 0),
    blocked_count = omniport_metrics.blocked_count + COALESCE((p_by_lane->>'BLOCKED')::INTEGER, 0),
    p95_latency = GREATEST(omniport_metrics.p95_latency, p_p95),
    max_latency = GREATEST(omniport_metrics.max_latency, p_max),
    dlq_depth = p_dlq_depth;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get aggregated metrics for dashboard
CREATE OR REPLACE FUNCTION get_omniport_metrics(
  p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour',
  p_end_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalRequests', SUM(total_requests),
    'successRate', CASE
      WHEN SUM(total_requests) > 0
      THEN ROUND((SUM(success_count)::NUMERIC / SUM(total_requests) * 100), 1)::TEXT || '%'
      ELSE '100%'
    END,
    'p95Latency', MAX(p95_latency)::TEXT || 'ms',
    'healthStatus', CASE
      WHEN SUM(total_requests) = 0 THEN 'healthy'
      WHEN (SUM(success_count)::NUMERIC / NULLIF(SUM(total_requests), 0) * 100) >= 99 AND MAX(p95_latency) < 100 THEN 'healthy'
      WHEN (SUM(success_count)::NUMERIC / NULLIF(SUM(total_requests), 0) * 100) >= 95 AND MAX(p95_latency) < 500 THEN 'degraded'
      ELSE 'unhealthy'
    END,
    'dlqDepth', COALESCE((SELECT COUNT(*) FROM omniport_dlq WHERE status = 'pending'), 0),
    'bySource', jsonb_build_object(
      'text', SUM(text_count),
      'voice', SUM(voice_count),
      'webhook', SUM(webhook_count),
      'api', SUM(api_count),
      'rcs', SUM(rcs_count),
      'whatsapp', SUM(whatsapp_count)
    ),
    'byLane', jsonb_build_object(
      'GREEN', SUM(green_count),
      'YELLOW', SUM(yellow_count),
      'RED', SUM(red_count),
      'BLOCKED', SUM(blocked_count)
    ),
    'timeRange', jsonb_build_object(
      'start', p_start_time,
      'end', p_end_time
    )
  ) INTO result
  FROM omniport_metrics
  WHERE metric_window >= p_start_time AND metric_window <= p_end_time;

  RETURN COALESCE(result, jsonb_build_object(
    'totalRequests', 0,
    'successRate', '100%',
    'p95Latency', '0ms',
    'healthStatus', 'healthy',
    'dlqDepth', 0,
    'bySource', jsonb_build_object('text', 0, 'voice', 0, 'webhook', 0, 'api', 0, 'rcs', 0, 'whatsapp', 0),
    'byLane', jsonb_build_object('GREEN', 0, 'YELLOW', 0, 'RED', 0, 'BLOCKED', 0)
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process DLQ entries
CREATE OR REPLACE FUNCTION get_omniport_dlq_retryable(p_limit INTEGER DEFAULT 100)
RETURNS SETOF omniport_dlq AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM omniport_dlq
  WHERE status = 'pending'
    AND next_retry_at <= NOW()
  ORDER BY next_retry_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE omniport_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE omniport_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE omniport_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE omniport_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to omniport_devices" ON omniport_devices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to omniport_events" ON omniport_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to omniport_dlq" ON omniport_dlq
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to omniport_metrics" ON omniport_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can read their own events
CREATE POLICY "Users can read own events" ON omniport_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can read their own devices
CREATE POLICY "Users can read own devices" ON omniport_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE omniport_devices IS 'Zero-trust device registry for OmniPort ingress validation';
COMMENT ON TABLE omniport_events IS 'Canonical event log for all OmniPort ingress';
COMMENT ON TABLE omniport_dlq IS 'Dead Letter Queue for failed event delivery with exponential backoff';
COMMENT ON TABLE omniport_metrics IS 'Aggregated metrics for OmniPort dashboard (1-minute windows)';
COMMENT ON FUNCTION get_omniport_metrics IS 'Returns aggregated OmniPort metrics for OmniDash dashboards';
