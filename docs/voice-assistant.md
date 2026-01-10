# Voice Assistant Pipeline (OpenAI Realtime API + Observability)

## Overview
The TradeLine 24/7 Voice Assistant utilizes OpenAI's Realtime API for ultra-low latency conversational AI. This implementation features comprehensive observability, state management, and UX optimizations designed for enterprise-grade voice interactions.

**Key Components:**
- **OpenAI Realtime API** - GPT-4o model with server-side voice activity detection
- **Enhanced Telemetry** - High-precision timing and throughput metrics
- **Ephemeral State Management** - Conversation context preservation across turns
- **Real-time Dashboard** - Live performance monitoring and alerting
- **Optimized UX** - 450ms silence duration for responsive barge-in behavior

## Architecture

### Core Pipeline Flow
```
Twilio WebSocket → OpenAI Realtime API → Enhanced Logging → VoiceHealth Dashboard
     ↓                    ↓                       ↓                    ↓
   Timing Capture    State Management      Structured Metrics    Real-time Alerts
   (twilio_start)    (conversationState)   (JSON telemetry)     (P95/P99 latency)
```

### Phase 1: Diagnostics & Telemetry
**High-Precision Timing Instrumentation:**
- `twilio_start`: Timestamp when Twilio WebSocket connects
- `openai_connect`: Timestamp when OpenAI WebSocket opens
- `first_byte_latency`: Time from user speech end to first AI audio byte
- `message_count`: Total WebSocket messages processed
- `silence_nudges`: Number of timeout nudges sent

**Structured Logging:**
```json
{
  "call_sid": "CA123...",
  "twilio_start": 1704748800000,
  "openai_connect": 1704748800150,
  "first_byte_latency_ms": 245,
  "message_count": 127,
  "silence_nudges": 0,
  "conversation_duration_s": 45,
  "turn_count": 3,
  "timestamp": "2026-01-08T21:00:00.000Z"
}
```

### Phase 2: Dashboard & Metrics Aggregation
**Real-time Performance Monitoring:**
- Handshake latency percentiles (P50/P95/P99)
- First-byte latency tracking
- Message throughput analysis
- Silence detection frequency
- Stream fallback rates

**VoiceHealth Dashboard Features:**
- Live metrics with 24h rolling windows
- Automated alerting on performance degradation
- Historical trend analysis
- Real-time SLO monitoring

### Phase 3: Latency & UX Optimization
**Turn Detection Tuning:**
- `silence_duration_ms`: 450ms (optimized from 600ms)
- `prefix_padding_ms`: 300ms (maintained for barge-in responsiveness)
- `threshold`: 0.5 (voice activity detection sensitivity)

**System Prompt Optimization:**
- Added "Reply in under 2 sentences to prevent audio overlap" instruction
- Maintains conversational brevity while preserving natural flow
- Prevents audio overlap issues in live conversations

### Phase 4: State & Memory Management
**Ephemeral Conversation State:**
```typescript
const conversationState = {
  caller_name?: string;
  callback_number?: string;
  email?: string;
  job_summary?: string;
  preferred_datetime?: string;
  consent_recording?: boolean;
  consent_sms_opt_in?: boolean;
  call_category?: string;
}
```

**Context Preservation:**
- Captured fields automatically stored in state
- State injected into system prompt for personalized responses
- Prevents repetitive information requests
- Maintains conversation continuity across network interruptions

## Environment Configuration

**Required Secrets:**
```
OPENAI_API_KEY=sk-...  # OpenAI API key with Realtime API access
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=...  # For database writes
```

**Optional Configuration:**
```
VOICE_STREAM_SECRET=...  # For secure stream authentication
SAFETY_ENFORCEMENT_MODE=log|block  # Default: log
```

## Usage

### Direct API Integration
```typescript
// Voice stream handled automatically via Twilio WebSocket
// Metrics collected in voice_stream_logs table
// Dashboard updated via ops-voice-health endpoint
```

### Health Check Endpoint
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-project.supabase.co/functions/v1/ops-voice-health
```

### Monitoring Dashboard
Access the VoiceHealth dashboard at `/ops/voice-health` for:
- Real-time latency metrics
- Performance trend analysis
- Automated SLO alerting
- Detailed call analytics

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| **Handshake Latency** | < 1500ms P95 | OpenAI connection timing |
| **First-Byte Latency** | < 500ms P95 | User speech to AI audio |
| **Conversation Turn Latency** | < 2000ms P95 | End-to-end turn time |
| **Silence Nudge Frequency** | < 0.1/min | Timeout detection optimization |
| **Platform Uptime** | > 99.9% | Enterprise-grade infrastructure |

## Testing

### Unit Tests
- Voice stream telemetry validation
- State management persistence
- Latency calculation accuracy
- WebSocket event handling

### Integration Tests
- End-to-end call flow simulation
- Metrics aggregation verification
- Dashboard data accuracy
- Performance under load

### Production Monitoring
- Real-time SLO tracking
- Automated alerting thresholds
- Performance regression detection
- Customer impact assessment

## Deployment Playbook

### Pre-deployment Checklist
- [ ] OpenAI API key configured with Realtime API access
- [ ] Database migration applied (`20260108000000_extend_voice_stream_logs.sql`)
- [ ] Supabase Edge Functions deployed
- [ ] VoiceHealth dashboard accessible
- [ ] Twilio webhooks configured

### Deployment Steps
1. **Environment Setup**: Configure OpenAI API key and Supabase credentials
2. **Database Migration**: Apply schema extensions for new metrics
3. **Function Deployment**: Deploy updated `voice-stream` and `ops-voice-health` functions
4. **Dashboard Update**: Deploy VoiceHealth component changes
5. **Testing**: Place test calls to verify metrics collection and display

### Monitoring & Rollback
- **Success Criteria**: All latency metrics within targets, no error spikes
- **Rollback Triggers**: >5% increase in P95 latency, >1% call failure rate
- **Rollback Plan**: Revert to previous function versions, maintain dashboard access

## Troubleshooting

### Common Issues
- **High Latency**: Check OpenAI API status, verify network connectivity
- **Missing Metrics**: Confirm database permissions, check Edge Function logs
- **State Loss**: Verify conversationState persistence, check for WebSocket disconnections
- **Audio Overlap**: Adjust silence_duration_ms, review system prompt brevity

### Debug Commands
```bash
# Check Edge Function logs
supabase functions logs voice-stream --follow

# Query recent metrics
supabase db query "SELECT * FROM voice_stream_logs ORDER BY started_at DESC LIMIT 10"

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-project.supabase.co/functions/v1/ops-voice-health
```

## Security Considerations

- **API Key Protection**: OpenAI keys never exposed to client-side code
- **Data Encryption**: All voice data encrypted in transit and at rest
- **PII Handling**: Sensitive data redacted in logs and monitoring
- **Access Control**: Dashboard protected by Supabase authentication
- **Audit Trail**: All voice interactions logged with compliance metadata

## Future Enhancements

- **Multi-language Support**: Expand beyond English conversations
- **Voice Cloning**: Custom voice models for enterprise clients
- **Advanced Analytics**: ML-powered conversation insights
- **Real-time Coaching**: Agent assistance during live calls
- **Integration APIs**: Third-party CRM and communication platform connectors

---

**Implementation Date:** January 8, 2026
**Version:** 2.0 (OpenAI Realtime API)
**Status:** 🟢 Production Ready
**Owner:** AI/Voice Engineering Team

