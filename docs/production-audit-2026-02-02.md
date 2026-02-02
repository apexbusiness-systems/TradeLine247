# Production Audit — 2026-02-02

## 1. Repo overview
- **Stack**: Vite 7 + React 18 + TypeScript 5.9 + Supabase + Capacitor/Native + Tailwind/shadcn UI + lucide icons.
- **Entrypoints**: `src/main.tsx` → `src/App.tsx` (Router + LayoutShell + SafeErrorBoundary + Analytics). `App` lazily loads every route except `Index` and uses `LayoutShell` / `AppLayout`.
- **Key scripts**: `npm run dev`, `npm run build:web`, `npm run test:ci`, `npm run lint`, `npm run audit:features` (new), `npm run security:*`, `npm run verify:*`.
- **CI reference**: `.github/workflows/ci.yml`, `ci-lighthouse.yml`, `codeql-analysis.yml`, `security-scan.yml`, `audit icon/generate`, etc.

## 2. Preflight & verification baseline
1. `npm install` (node 20.19.6 / npm 10.9.3).
2. `npm run test:ci` (lint → typecheck → `test:unit` → `build:web`) — all steps pass, only lint/test warnings from existing suites (e.g. act warnings, Supabase warnings, Vite reporter noting dynamic import and missing NODE_ENV=production support).
3. `npm run audit:features` (new) — validates every route defined in `src/routes/paths.ts` + `/auth-landing` has an entry in `src/features/feature-registry.json`.

## 3. Feature inventory (partial snapshot)
Full registry is the single source of truth: `src/features/feature-registry.json`. Highlights below:

| Feature | Route | Status | Mode | Description |
| --- | --- | --- | --- | --- |
| Landing experience | `/` | ready | wired | Hero + lead capture funnel |
| Features page | `/features` | ready | wired | Product/feature grid |
| Pricing + no-monthly anchor | `/pricing#no-monthly` | ready | wired | Pricing tiers + CTA |
| Security | `/security` | ready | wired | Compliance story |
| FAQ | `/faq` | ready | wired | Common questions |
| Client dashboard | `/dashboard` | ready | wired | Post-auth console (Requires auth) |
| Campaign manager | `/campaign-manager` | ready | wired | Campaign orchestration |
| Voice health | `/ops/voice-health` | ready | wired | Operational telemetry |

> **Note**: Registry also contains admin, ops, and utility routes (Calls, Twilio evidence, integrations, fallback) so nav rendering can pull from a single dataset.

## 4. Issues list (P0–P3)
| Severity | Issue | Evidence | Mitigation |
| --- | --- | --- | --- |
| P3 | Vite warns that `@supabase/supabase-js/dist/esm/wrapper.mjs` imports a non-existent default export. | `npm run test:ci` build output shows “default is not exported by ... wrapper.mjs”. | Keep Vite/ESM build as is; file is provided by Supabase (no immediate fix). |
| P3 | Vite reporter warns about mixed dynamic/static imports of `errorReporter`. | `vite build` output logs repeated reporter warning. | Accept for now; future bundler refactor to unify import style. |
| P3 | Vite logs “NODE_ENV=production is not supported in the .env file.” | Build log message. | Acknowledge until env handling migrates; no functional failure. |

## 5. Docs summary
- `docs/production-audit-2026-02-02.md` (this file) documents repo overview, verification, feature inventory, issues, and cleanup. Date-stamped 2026-02-02.
- Added `src/features/feature-registry.json` + reference `src/features/registry.ts` to enforce single source for routes/feature metadata.

## 6. Cleanup summary
- No code deleted. Added the feature registry + script so every route now has a registry entry and a validation gate.

## 7. Verification commands
1. `npm install`
2. `npm run test:ci`
3. `npm run audit:features`

