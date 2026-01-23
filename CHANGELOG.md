# Changelog

## 2026-01-23

### Added
- **OmniPort Universal Ingress Engine**: Production-grade ingress layer for unified input handling
  - Zero-trust device registry with fingerprint validation and trust scoring
  - FNV-1a based idempotency for high-throughput deduplication (10,000+ req/sec)
  - Canonical event normalization for text, voice, webhook, API, RCS, and WhatsApp inputs
  - 4-lane risk classification system (GREEN/YELLOW/RED/BLOCKED) with pattern matching
  - Dead Letter Queue (DLQ) with exponential backoff retry and CSPRNG jitter
  - Real-time metrics collector with P95 latency tracking and health status
  - Circuit breaker integration for resilient downstream dispatch
- **OmniPort Metrics API** (`GET /functions/v1/omniport-metrics`): Dashboard endpoint returning totalRequests, successRate, p95Latency, healthStatus, dlqDepth, bySource breakdown, and byLane distribution
- **OmniPort Health Dashboard** (`/ops/omniport-health`): Real-time monitoring interface with source charts, risk lane visualization, DLQ alerts, and circuit breaker state tracking
- **Database tables**: omniport_devices, omniport_events, omniport_dlq, omniport_metrics with RLS policies

### Security
- ReDoS-safe regex patterns using length-limited quantifiers to prevent catastrophic backtracking
- CSPRNG (crypto.getRandomValues) for DLQ backoff jitter calculation
- 10KB content truncation before pattern matching for defense-in-depth

## 2025-10-19

### Added
- Documented the AI concierge rollout, including supported languages, transcript delivery, and human escalation paths for support operations and marketing alignment.
- Published the AI Concierge FAQ for customers and internal teams to reference.
