# Changelog

## 2026-03-03

### Changed
- Completed a production-readiness audit pass and removed a mixed static/dynamic `errorReporter` import path in `useAuth`, reducing avoidable bundler chunking warnings during build.
- Re-ran release checks (`lint`, `typecheck`, `build:web`) and confirmed green CI gates for this release candidate.
- Bumped application version to **1.0.8** and aligned audit documentation dates for release tracking.

## 2025-10-19

### Added
- Documented the AI concierge rollout, including supported languages, transcript delivery, and human escalation paths for support operations and marketing alignment.
- Published the AI Concierge FAQ for customers and internal teams to reference.
