# Changelog

## 2026-01-23

### Added
- **OmniPort Platform Integration**: Client SDK for connecting to the OmniPort universal ingress platform
  - `OmniPortClient` class for authenticated API communication with OmniPort
  - `getOmniPortMetrics()` - Fetch real-time metrics from OmniPort platform
  - `sendToOmniPort()` - Send events to OmniPort for processing and risk classification
  - Device registration and trust verification via OmniPort's zero-trust registry
  - Real-time event subscription support for live dashboards
- **OmniPort Metrics Proxy** (`GET /functions/v1/omniport-metrics`): Proxy endpoint fetching metrics from OmniPort platform
- **OmniPort Dashboard** (`/ops/omniport-health`): Real-time monitoring interface displaying OmniPort platform metrics including source breakdown, risk lanes, and DLQ status
- **Environment Configuration**: Added `OMNI_PORT_BASE_URL` and `OMNI_PORT_SERVICE_KEY` for platform authentication

## 2025-10-19

### Added
- Documented the AI concierge rollout, including supported languages, transcript delivery, and human escalation paths for support operations and marketing alignment.
- Published the AI Concierge FAQ for customers and internal teams to reference.
