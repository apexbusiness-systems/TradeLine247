# Changelog

## 2026-02-02

### Added
- Added a single-source feature registry (`src/features/feature-registry.json` + `src/features/registry.ts`) plus header rendering logic so marketing and admin navs derive from that catalog, keeping locked states deterministic.
- Added `scripts/audit-features.mjs` and `npm run audit:features` to ensure every route/path is registered and flagged, and documented the baseline in `docs/production-audit-2026-02-02.md`.
- Hardened tests by stubbing `fetch` in `src/setupTests.tsx` and allowing JSON imports via `tsconfig.app.json`, making `npm run test:ci` + `audit:features` repeatable.

## 2025-10-19

### Added
- Documented the AI concierge rollout, including supported languages, transcript delivery, and human escalation paths for support operations and marketing alignment.
- Published the AI Concierge FAQ for customers and internal teams to reference.
