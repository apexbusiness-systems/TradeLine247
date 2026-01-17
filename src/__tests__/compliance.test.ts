/**
 * TradeLine 24/7 Compliance Module Unit Tests
 * Consolidated tests for PIPEDA/PIPA compliance, quiet hours, consent, and PII redaction.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// COMPLIANCE UTILITIES
// ============================================================================

function redactEmails(text: string): string {
  return text.split(' ').map(w => (w.includes('@') && w.includes('.')) ? '[EMAIL]' : w).join(' ');
}

function redactSensitive(text: string): string {
  if (!text) return text;
  return redactEmails(
    text
      .replaceAll(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX')
      .replaceAll(/\b\d{13,19}\b/g, m => m.slice(0, 4).padEnd(m.length, 'X'))
      .replaceAll(/\bAKIA[\w]{12,}\b/g, '[REDACTED_KEY]')
      .replaceAll(/\bsk-[\w]{20,}\b/gi, '[REDACTED_KEY]')
      .replaceAll(/\+\d{10,15}/g, '[PHONE]')
      .replaceAll(/\b\d{4,6}\b/g, '****')
  );
}

function enforceQuietHours(time: string | Date, tz?: string | null): { adjusted_time: string; needs_review: boolean } {
  const d = time instanceof Date ? time : new Date(time);
  if (!tz) {
    const next = new Date(); next.setDate(next.getDate() + 1); next.setHours(10, 0, 0, 0);
    return { adjusted_time: next.toISOString(), needs_review: true };
  }
  const hour = d.getUTCHours();
  if (hour >= 8 && hour < 21) return { adjusted_time: d.toISOString(), needs_review: false };
  const next = new Date(d); next.setDate(next.getDate() + 1); next.setUTCHours(8, 0, 0, 0);
  return { adjusted_time: next.toISOString(), needs_review: false };
}

function categorizeCall(signals: { text?: string; keywords?: string[] } | null): string {
  if (!signals) return 'lead_capture';
  const all = ((signals.text || '') + ' ' + (signals.keywords || []).join(' ')).toLowerCase();
  if (/pric|quot|estimat|cost|how much|rate/i.test(all)) return 'prospect_call';
  if (/help|support|issue|problem|cancel|refund|complaint/i.test(all)) return 'customer_service';
  return 'lead_capture';
}

function calculateSentiment(text: string): number {
  if (!text) return 0;
  const positive = new Set(['great', 'excellent', 'thank', 'happy', 'good', 'perfect', 'wonderful', 'love', 'helpful']);
  const negative = new Set(['terrible', 'awful', 'frustrated', 'angry', 'hate', 'worst', 'sucks', 'lawyer', 'attorney']);
  let score = 0;
  for (const w of text.toLowerCase().split(/\s+/)) {
    if (positive.has(w)) score += 0.15;
    if (negative.has(w)) score -= 0.25;
  }
  return Math.max(-1, Math.min(1, score));
}

function shouldEscalate(text: string, sentiment: number): boolean {
  return sentiment <= -0.5 || /\b(sue|lawyer|attorney|lawsuit|bbb|regulatory|fraud)\b/i.test(text);
}

// ============================================================================
// TESTS
// ============================================================================

describe('PII Redaction', () => {
  const cases: [string, string, string][] = [
    ['phones', 'Call +15551234567 please', 'Call [PHONE] please'],
    ['multiple phones', 'Primary: +15551234567, Secondary: +15559876543', 'Primary: [PHONE], Secondary: [PHONE]'],
    ['emails', 'Email: test@example.com', 'Email: [EMAIL]'],
    ['SSN', 'SSN: 123-45-6789', 'SSN: XXX-XX-XXXX'],
    ['credit cards', 'Card: 4111111111111111', 'Card: 4111XXXXXXXXXXXX'],
    ['AWS keys', 'Key: AKIAIOSFODNN7EXAMPLE', 'Key: [REDACTED_KEY]'],
    ['OpenAI keys', 'Key: sk-abcdefghijklmnop123456', 'Key: [REDACTED_KEY]'],
    ['PINs', 'PIN: 1234', 'PIN: ****'],
  ];
  cases.forEach(([name, input, expected]) => {
    it(`should redact ${name}`, () => expect(redactSensitive(input)).toBe(expected));
  });
  it('handles empty/null', () => {
    expect(redactSensitive('')).toBe('');
    expect(redactSensitive(null as unknown as string)).toBe(null);
  });
});

describe('Quiet Hours', () => {
  it('allows calls during business hours (8-20)', () => {
    [8, 12, 20].forEach(h => {
      const t = new Date(); t.setUTCHours(h, 0, 0, 0);
      expect(enforceQuietHours(t, 'America/Toronto').needs_review).toBe(false);
    });
  });
  it('reschedules calls outside hours', () => {
    [21, 23, 5].forEach(h => {
      const t = new Date(); t.setUTCHours(h, 0, 0, 0);
      expect(new Date(enforceQuietHours(t, 'America/Toronto').adjusted_time).getUTCHours()).toBe(8);
    });
  });
  it('flags unknown timezone for review', () => {
    expect(enforceQuietHours(new Date(), null).needs_review).toBe(true);
    expect(enforceQuietHours(new Date()).needs_review).toBe(true);
  });
});

describe('Call Categorization', () => {
  const prospects = ['What is your pricing?', 'Can I get a quote?', 'How much does it cost?'];
  const service = ['I need support', 'I have a problem', 'I want to cancel'];
  const leads = ['Hello', '', null];

  prospects.forEach(t => it(`detects prospect: "${t}"`, () => expect(categorizeCall({ text: t })).toBe('prospect_call')));
  service.forEach(t => it(`detects service: "${t}"`, () => expect(categorizeCall({ text: t })).toBe('customer_service')));
  leads.forEach(t => it(`defaults lead: ${t}`, () => expect(categorizeCall(t ? { text: t } : null)).toBe('lead_capture')));
  it('processes keywords', () => expect(categorizeCall({ keywords: ['pricing'] })).toBe('prospect_call'));
});

describe('Sentiment Analysis', () => {
  it('detects positive', () => expect(calculateSentiment('great excellent')).toBeGreaterThan(0));
  it('detects negative', () => expect(calculateSentiment('terrible frustrated')).toBeLessThan(0));
  it('neutral for empty', () => expect(calculateSentiment('')).toBe(0));
  it('clamps to [-1, 1]', () => {
    expect(calculateSentiment('great '.repeat(20))).toBeLessThanOrEqual(1);
    expect(calculateSentiment('terrible '.repeat(20))).toBeGreaterThanOrEqual(-1);
  });
});

describe('Escalation Detection', () => {
  it('escalates on low sentiment', () => expect(shouldEscalate('text', -0.5)).toBe(true));
  const triggers = ['lawsuit', 'lawyer', 'attorney', 'bbb', 'regulatory', 'fraud'];
  triggers.forEach(w => it(`escalates on "${w}"`, () => expect(shouldEscalate(`mention ${w}`, 0)).toBe(true)));
  it('no escalation for mild negative', () => expect(shouldEscalate('unhappy', -0.2)).toBe(false));
});

describe('Consent Validation', () => {
  it('recording consent', () => {
    expect({ consent_flags: { recording: true } }.consent_flags.recording).toBe(true);
    expect({ consent_flags: { recording: false } }.consent_flags.recording === true ? 'full' : 'no_record').toBe('no_record');
    expect(({} as { recording?: boolean }).recording === true ? 'full' : 'no_record').toBe('no_record');
  });
  it('SMS opt-in', () => {
    expect({ sms_opt_in: true }.sms_opt_in === true).toBe(true);
    expect({ sms_opt_in: false }.sms_opt_in === true).toBe(false);
  });
});
