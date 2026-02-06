# TradeLine 24/7 — Feature Registry

> Canonical registry of every production feature, its status, backing service, and owner.
> Last updated: 2026-02-06

---

## 1. Core Platform

| Feature | Status | Backing Service | Route |
|---------|--------|-----------------|-------|
| Landing Page | **Live** | Static / SEO | `/` |
| Features Page | **Live** | Static | `/features` |
| Pricing Page | **Live** | Static | `/pricing` |
| FAQ Page | **Live** | Static | `/faq` |
| Comparison Page | **Live** | Static | `/compare` |
| Contact Form | **Live** | Supabase | `/contact` |
| Privacy Policy | **Live** | Static | `/privacy` |
| Terms of Service | **Live** | Static | `/terms` |
| Security Overview | **Live** | Static | `/security` |
| 404 Page | **Live** | Static | `/*` |

---

## 2. Authentication & Authorization

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| Email/Password Auth | **Live** | Supabase Auth | JWT sessions, auto-refresh |
| Magic Link Auth | **Live** | Supabase Auth | Passwordless login |
| Route Protection | **Live** | `RequireAuth` component | Redirects to `/auth` |
| Admin Route Protection | **Live** | `ProtectedAdminRoute` + `admin-check` edge fn | Server-verified |
| Session Timeout | **Live** | `useEnhancedSessionSecurity` hook | 15 min inactivity |
| MFA Setup | **Live** | `mfa-setup` edge function | TOTP-based |
| MFA Verify | **Live** | `mfa-verify` edge function | |
| Password Breach Check | **Live** | `check-password-breach` edge fn | HaveIBeenPwned API |
| Membership Provisioning | **Live** | `ensureMembership` + `start-trial` edge fn | Auto-creates org on login |

---

## 3. Dashboard

| Feature | Status | Backing Service | Route |
|---------|--------|-----------------|-------|
| Client Dashboard | **Live** | Supabase real-time | `/dashboard` |
| KPI Cards | **Live** | `useDashboardData` hook | |
| Recent Activity Feed | **Live** | `useRecentActivity` hook | |
| Quick Actions | **Live** | Static config + navigation | |
| Service Health Monitor | **Live** | Supabase queries | |
| Twilio Call Stats | **Live** | `useTwilioCallData` hook | |
| Live Call Summary | **Live** | Twilio real-time | |
| ROI Dashboard | **Feature-flagged** | Supabase RPC | Requires `ROI_DASHBOARD_ENABLED` |
| Email AI Summary | **Feature-flagged** | Supabase | Requires `RAG_FEATURE_ENABLED` + `EMAIL_AI_ENABLED` |
| Theme Switcher | **Live** | `userPreferencesStore` | |
| Settings Dialog | **Live** | Zustand store | |

---

## 4. Voice & Telephony

| Feature | Status | Backing Service | Route |
|---------|--------|-----------------|-------|
| AI Voice Receptionist | **Live** | Twilio + ElevenLabs | Inbound calls |
| Voice Health Check | **Live** | `voice-health` edge fn | `/ops/voice-health` |
| Voice Settings | **Live** | Supabase | `/ops/voice` |
| Voice Forwarding Wizard | **Live** | Edge functions | `/ops/forwarding` |
| Call Center | **Live** | Twilio + Supabase | `/calls` |
| Call Logs | **Live** | Supabase real-time | `/call-logs` |
| Voice Monitoring | **Live** | Supabase | `/internal/voice-monitoring` |
| Sentiment Analysis | **Live** | `sentimentService` (server) | Pipeline stage |
| Empathetic Speech | **Live** | `voicePipeline` (server) | ElevenLabs TTS |
| Voicemail Recording | **Live** | `voice-voicemail` edge fn | |
| Voice Fallback | **Live** | `voice-fallback` edge fn | |
| Voice Recording Callback | **Live** | `voice-recording-callback` edge fn | |
| Caller ID Verification | **Live** | `callerid-verify-start/check` edge fns | |

---

## 5. Messaging Channels

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| SMS Delivery | **Live** | `send-sms` edge fn + Twilio | |
| SMS Delivery Dashboard | **Live** | Supabase | `/sms-delivery-dashboard` |
| SMS Reply (WebComms) | **Live** | `webcomms-sms-reply` edge fn | |
| RCS Messaging | **Disabled** | `send-rcs` edge fn (via Supabase) | Feature-flagged: `FEATURE_RCS` |
| WhatsApp | **Disabled** | Stub | Feature-flagged: `FEATURE_WHATSAPP` |
| Messaging Health | **Live** | Supabase | `/ops/messaging-health` |
| A2P Registration | **Live** | Supabase + Twilio | Tracked in messaging health |

---

## 6. Integrations

| Feature | Status | Backing Service | Route |
|---------|--------|-----------------|-------|
| Integration Hub | **Live** | Static + navigation | `/integrations` |
| CRM Integration | **Live** | `integration-connect` edge fn | `/dashboard/integrations/crm` |
| Messaging Integration | **Live** | `integration-connect` edge fn | `/dashboard/integrations/messaging` |
| Phone Integration | **Live** | `integration-connect` edge fn | `/dashboard/integrations/phone` |
| Email Integration | **Live** | `integration-connect` edge fn | `/dashboard/integrations/email` |
| Automation Integration | **Live** | `integration-connect` edge fn | `/dashboard/integrations/automation` |
| Mobile Integration | **Live** | App Store / Play Store | `/dashboard/integrations/mobile` |
| OmniLink Integration | **Live** | `OmniLinkClient` | Health at `/health/omnlink` |
| OmniPort Health | **Live** | Supabase edge fn | `/ops/omniport-health` |
| Calendar Integration | **Live** | OAuth providers | Component-level |

---

## 7. AI & Search

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| AI Chat | **Live** | `chat` edge fn + OpenAI | Streaming SSE |
| RAG Search | **Live** | `rag-retrieve` edge fn | Drawer + FAB UI |
| AI Onboarding Wizard | **Live** | Supabase | Multi-step wizard |
| AI SEO Head | **Live** | Static / structured data | Schema.org markup |
| Visual Risk Analyzer | **Live** | `visual-risk-analyzer` edge fn | |

---

## 8. Admin & Operations

| Feature | Status | Backing Service | Route |
|---------|--------|-----------------|-------|
| Enterprise Dashboard | **Live** | REST API | Admin-only |
| Escalation Management | **Live** | `resolve-escalation` edge fn | |
| Admin KB | **Live** | Supabase | `/admin-kb` |
| Security Monitoring | **Live** | `useSecurityMonitoring` hook | `/security-monitoring` |
| Twilio Evidence | **Live** | Supabase | `/ops/twilio-evidence` |
| Twilio Wire | **Live** | Edge functions | `/ops/twilio-wire` |
| Campaign Manager | **Live** | Supabase | `/campaign-manager` |
| Client Number Onboarding | **Live** | Multiple edge fns | `/ops/client-onboard` |
| Activation | **Live** | Edge function | `/ops/activation` |
| Team Invite | **Live** | `send-team-invites` edge fn | `/team/invite` |

---

## 9. Security & Compliance

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| Rate Limiting | **Live** | Express middleware + Supabase | 3-tier limits |
| Security Headers (CSP/HSTS) | **Live** | Helmet.js | Env-driven |
| CORS Protection | **Live** | Express middleware | Prod-only localhost block |
| Session Validation | **Live** | `validate-session` edge fn | |
| Encryption Init | **Live** | `init-encryption-key` edge fn | |
| Consent Logs Export | **Live** | `consent-logs-export` edge fn | GDPR/PIPEDA |
| Security Compliance | **Live** | `useSecurityCompliance` hook | RLS audit |
| Secure Analytics | **Live** | `secure-analytics` edge fn | Privacy-preserving |
| A/B Testing | **Disabled** | `secure-ab-assign` / `ab-convert` edge fns | `AB_ENABLED: false` |

---

## 10. Mobile & PWA

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| PWA Install | **Live** | Service Worker + manifest | `InstallPrompt` component |
| Push Notifications | **Live** | FCM + Express routes | iOS + Android |
| Deep Linking | **Live** | `useDeepLinks` hook | Capacitor |
| Offline Data | **Live** | `useOfflineData` hook | Local cache |
| Network Status | **Live** | `useNetworkStatus` hook | |
| iOS Native App | **Live** | Capacitor | App Store |
| Android Native App | **Live** | Capacitor | Google Play |

---

## 11. Observability

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| Error Reporter | **Live** | `errorReporter` lib | Centralized |
| Performance Monitor | **Live** | `performanceMonitor` lib | |
| Web Vitals Tracker | **Live** | `WebVitalsReporter` component | |
| Boot Sentinel | **Live** | `BootCoordinator` lib | Startup health |
| Blank Screen Detector | **Live** | `blankScreenDetector` lib | Auto-recovery |
| Preview Health Check | **Live** | `previewHealthCheck` lib | `/preview-health` |

---

## 12. Internationalization

| Feature | Status | Backing Service | Notes |
|---------|--------|-----------------|-------|
| English (en) | **Live** | i18next + `/public/locales/en/` | Default |
| French-Canadian (fr-CA) | **Live** | i18next + `/public/locales/fr-CA/` | |
| Language Switcher | **Live** | `LanguageSwitcher` component | |

---

## Feature Flags Reference

| Flag | Default | Env Variable | Controls |
|------|---------|-------------|----------|
| `RCS_ENABLED` | `false` | `VITE_FEATURE_RCS` | RCS messaging channel |
| `WHATSAPP_ENABLED` | `false` | `VITE_FEATURE_WHATSAPP` | WhatsApp channel |
| `VOICE_AI_ENABLED` | `false` | `VITE_FEATURE_VOICE_AI` | Voice AI features |
| `AB_ENABLED` | `false` | Hardcoded | A/B testing system |
| `SPLASH_V2_ENABLED` | `false` | `VITE_SPLASH_V2_ENABLED` | Splash screen v2 |
| `ROI_DASHBOARD_ENABLED` | DB-driven | `feature_flags` table | ROI dashboard |
| `RAG_FEATURE_ENABLED` | DB-driven | `feature_flags` table | RAG search |
| `EMAIL_AI_ENABLED` | DB-driven | `feature_flags` table | Email AI summary |

---

## Supabase Edge Functions

| Function | Purpose | Status |
|----------|---------|--------|
| `admin-check` | Admin role verification | **Live** |
| `chat` | AI chat with streaming | **Live** |
| `send-sms` | SMS delivery via Twilio | **Live** |
| `voice-health` | Voice system health check | **Live** |
| `voice-fallback` | Voice call fallback handler | **Live** |
| `voice-voicemail` | Voicemail recording | **Live** |
| `voice-recording-callback` | Recording webhook | **Live** |
| `rag-retrieve` | RAG search retrieval | **Live** |
| `mfa-setup` | MFA enrollment | **Live** |
| `mfa-verify` | MFA verification | **Live** |
| `validate-session` | Session token validation | **Live** |
| `init-encryption-key` | Encryption key init | **Live** |
| `consent-logs-export` | GDPR data export | **Live** |
| `secure-analytics` | Privacy-preserving analytics | **Live** |
| `resolve-escalation` | Escalation resolution | **Live** |
| `onboarding-provision` | New client provisioning | **Live** |
| `create-booking` | Appointment booking | **Live** |
| `lookup-number` | Phone number lookup | **Live** |
| `webcomms-sms-reply` | SMS reply webhook | **Live** |
| `vision-anchor` | Visual anchoring | **Live** |
| `visual-risk-analyzer` | Risk analysis | **Live** |
