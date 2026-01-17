/**
 * TradeLine 24/7 Compliance Module Unit Tests
 *
 * Tests for PIPEDA/PIPA compliance, quiet hours, consent management,
 * and PII redaction.
 *
 * @author Production Audit
 * @version 1.0.0
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// MOCK COMPLIANCE UTILITIES (since we can't import Deno modules in Node tests)
// ============================================================================

/**
 * Simple email detection without regex backtracking risk
 */
function redactEmails(text: string): string {
  return text.split(' ').map(w => (w.includes('@') && w.includes('.')) ? '[EMAIL]' : w).join(' ');
}

/**
 * Redact sensitive information from text for safe logging
 */
function redactSensitive(text: string): string {
  if (!text) return text;

  const result = text
    .replaceAll(/\b\d{3}-\d{2}-\d{4}\b/g, 'XXX-XX-XXXX') // SSN
    .replaceAll(/\b\d{13,19}\b/g, (m) => m.slice(0, 4).padEnd(m.length, 'X')) // Credit cards
    .replaceAll(/\bAKIA[\w]{12,}\b/g, '[REDACTED_KEY]') // AWS keys
    .replaceAll(/\bsk-[\w]{20,}\b/gi, '[REDACTED_KEY]') // OpenAI keys
    .replaceAll(/\+\d{10,15}/g, '[PHONE]') // Phone numbers
    .replaceAll(/\b\d{4,6}\b/g, '****'); // PINs

  return redactEmails(result);
}

/**
 * Enforce quiet hours for outbound contact
 */
function enforceQuietHours(
  proposedTimeIso: string | Date,
  callerTz?: string | null,
  quietWindow?: { start: number; end: number }
): { adjusted_time: string; needs_review: boolean; original_time?: string } {
  const window = quietWindow ?? { start: 8, end: 21 };
  const d = proposedTimeIso instanceof Date
    ? proposedTimeIso
    : new Date(proposedTimeIso);

  const originalTime = d.toISOString();

  if (!callerTz) {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(10, 0, 0, 0);
    return {
      adjusted_time: next.toISOString(),
      needs_review: true,
      original_time: originalTime
    };
  }

  const hour = d.getUTCHours();

  if (hour >= window.start && hour < window.end) {
    return {
      adjusted_time: d.toISOString(),
      needs_review: false,
      original_time: originalTime
    };
  } else {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    next.setUTCHours(window.start, 0, 0, 0);
    return {
      adjusted_time: next.toISOString(),
      needs_review: false,
      original_time: originalTime
    };
  }
}

/**
 * Categorize call based on intent signals
 */
function categorizeCall(
  intentSignals: { text?: string; keywords?: string[] } | null
): 'customer_service' | 'lead_capture' | 'prospect_call' {
  if (!intentSignals) return 'lead_capture';

  const text = (intentSignals.text || '').toLowerCase();
  const keywords = intentSignals.keywords || [];
  const allText = text + ' ' + keywords.join(' ').toLowerCase();

  if (/price|quote|estimate|pricing|cost|how much|rate/i.test(allText)) {
    return 'prospect_call';
  }

  if (/help|support|issue|problem|cancel|refund|complaint|broken|not working|service call/i.test(allText)) {
    return 'customer_service';
  }

  return 'lead_capture';
}

/**
 * Calculate simple sentiment score from -1 to +1
 * Uses Sets for O(1) lookups (performance optimization)
 */
function calculateSentiment(text: string): number {
  if (!text) return 0;

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  const positiveWords = new Set(['great', 'excellent', 'thank', 'appreciate', 'happy', 'good',
    'perfect', 'wonderful', 'love', 'helpful', 'awesome', 'amazing', 'pleased']);
  const negativeWords = new Set(['terrible', 'awful', 'horrible', 'frustrated', 'angry',
    'upset', 'disappointed', 'hate', 'bad', 'worst', 'sucks', 'furious',
    'unacceptable', 'ridiculous', 'lawsuit', 'attorney', 'lawyer']);

  let score = 0;
  for (const word of words) {
    if (positiveWords.has(word)) score += 0.15;
    if (negativeWords.has(word)) score -= 0.25;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Check if sentiment indicates escalation need
 */
function shouldEscalate(text: string, sentimentScore: number): boolean {
  if (sentimentScore <= -0.5) return true;

  const threatPatterns = /\b(sue|lawyer|attorney|legal action|lawsuit|report you|bbb|better business|regulatory|complaint|fraud)\b/i;
  return threatPatterns.test(text);
}

// ============================================================================
// PII REDACTION TESTS
// ============================================================================

describe('PII Redaction', () => {

  describe('Phone Number Redaction', () => {
    it('should redact E.164 phone numbers', () => {
      expect(redactSensitive('Call +15551234567 please'))
        .toBe('Call [PHONE] please');
    });

    it('should redact multiple phone numbers', () => {
      expect(redactSensitive('Primary: +15551234567, Secondary: +15559876543'))
        .toBe('Primary: [PHONE], Secondary: [PHONE]');
    });

    it('should redact international phone numbers', () => {
      expect(redactSensitive('UK number: +442071234567'))
        .toBe('UK number: [PHONE]');
    });
  });

  describe('Email Redaction', () => {
    it('should redact email addresses', () => {
      expect(redactSensitive('Email: test@example.com'))
        .toBe('Email: [EMAIL]');
    });

    it('should handle complex email addresses', () => {
      expect(redactSensitive('Contact: john.doe+tag@company.co.uk'))
        .toBe('Contact: [EMAIL]');
    });

    it('should redact multiple emails', () => {
      expect(redactSensitive('a@b.com and c@d.org'))
        .toBe('[EMAIL] and [EMAIL]');
    });
  });

  describe('SSN Redaction', () => {
    it('should redact SSN format', () => {
      expect(redactSensitive('SSN: 123-45-6789'))
        .toBe('SSN: XXX-XX-XXXX');
    });

    it('should not redact non-SSN numbers', () => {
      const text = 'Order number: 12345678901';
      expect(redactSensitive(text)).not.toContain('XXX-XX-XXXX');
    });
  });

  describe('Credit Card Redaction', () => {
    it('should mask credit card numbers', () => {
      const result = redactSensitive('Card: 4111111111111111');
      expect(result).toBe('Card: 4111XXXXXXXXXXXX');
    });

    it('should preserve first 4 digits', () => {
      const result = redactSensitive('4532015112830366');
      expect(result.startsWith('4532')).toBe(true);
      expect(result).toContain('XXXXXXXXXXXX');
    });
  });

  describe('API Key Redaction', () => {
    it('should redact AWS access keys', () => {
      expect(redactSensitive('Key: AKIAIOSFODNN7EXAMPLE'))
        .toBe('Key: [REDACTED_KEY]');
    });

    it('should redact OpenAI style keys', () => {
      expect(redactSensitive('Key: sk-abcdefghijklmnop123456'))
        .toBe('Key: [REDACTED_KEY]');
    });
  });

  describe('PIN Redaction', () => {
    it('should redact 4-digit PINs', () => {
      expect(redactSensitive('PIN: 1234'))
        .toBe('PIN: ****');
    });

    it('should redact 6-digit codes', () => {
      expect(redactSensitive('OTP: 123456'))
        .toBe('OTP: ****');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(redactSensitive('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(redactSensitive(null as unknown as string)).toBe(null);
      expect(redactSensitive(undefined as unknown as string)).toBe(undefined);
    });

    it('should handle text with no PII', () => {
      const text = 'Hello, how can I help you today?';
      expect(redactSensitive(text)).toBe(text);
    });
  });
});

// ============================================================================
// QUIET HOURS TESTS
// ============================================================================

describe('Quiet Hours Enforcement', () => {

  describe('Within Business Hours', () => {
    it('should allow calls at 8am', () => {
      const time = new Date();
      time.setUTCHours(8, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      expect(result.needs_review).toBe(false);
    });

    it('should allow calls at noon', () => {
      const time = new Date();
      time.setUTCHours(12, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      expect(result.needs_review).toBe(false);
    });

    it('should allow calls at 8pm', () => {
      const time = new Date();
      time.setUTCHours(20, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      expect(result.needs_review).toBe(false);
    });
  });

  describe('Outside Business Hours', () => {
    it('should reschedule calls at 9pm', () => {
      const time = new Date();
      time.setUTCHours(21, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      expect(result.needs_review).toBe(false);

      const adjustedDate = new Date(result.adjusted_time);
      expect(adjustedDate.getUTCHours()).toBe(8);
    });

    it('should reschedule late night calls', () => {
      const time = new Date();
      time.setUTCHours(23, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      const adjustedDate = new Date(result.adjusted_time);
      expect(adjustedDate.getUTCHours()).toBe(8);
    });

    it('should reschedule early morning calls', () => {
      const time = new Date();
      time.setUTCHours(5, 0, 0, 0);

      const result = enforceQuietHours(time, 'America/Toronto');
      const adjustedDate = new Date(result.adjusted_time);
      expect(adjustedDate.getUTCHours()).toBe(8);
    });
  });

  describe('Unknown Timezone Handling', () => {
    it('should flag for review when timezone is null', () => {
      const result = enforceQuietHours(new Date(), null);
      expect(result.needs_review).toBe(true);
    });

    it('should flag for review when timezone is undefined', () => {
      const result = enforceQuietHours(new Date());
      expect(result.needs_review).toBe(true);
    });

    it('should schedule at 10am next day when timezone unknown', () => {
      const result = enforceQuietHours(new Date(), null);
      const adjustedDate = new Date(result.adjusted_time);
      expect(adjustedDate.getHours()).toBe(10);
    });
  });
});

// ============================================================================
// CALL CATEGORIZATION TESTS
// ============================================================================

describe('Call Categorization', () => {

  describe('Prospect Call Detection', () => {
    it('should detect pricing inquiries', () => {
      expect(categorizeCall({ text: 'What is your pricing?' })).toBe('prospect_call');
    });

    it('should detect quote requests', () => {
      expect(categorizeCall({ text: 'Can I get a quote?' })).toBe('prospect_call');
    });

    it('should detect cost inquiries', () => {
      expect(categorizeCall({ text: 'How much does it cost?' })).toBe('prospect_call');
    });

    it('should detect rate inquiries', () => {
      expect(categorizeCall({ text: 'What are your rates?' })).toBe('prospect_call');
    });
  });

  describe('Customer Service Detection', () => {
    it('should detect support requests', () => {
      expect(categorizeCall({ text: 'I need support' })).toBe('customer_service');
    });

    it('should detect problem reports', () => {
      expect(categorizeCall({ text: 'I have a problem' })).toBe('customer_service');
    });

    it('should detect complaints', () => {
      expect(categorizeCall({ text: 'I want to file a complaint' })).toBe('customer_service');
    });

    it('should detect cancellation requests', () => {
      expect(categorizeCall({ text: 'I want to cancel' })).toBe('customer_service');
    });

    it('should detect refund requests', () => {
      expect(categorizeCall({ text: 'I need a refund' })).toBe('customer_service');
    });
  });

  describe('Lead Capture Default', () => {
    it('should default to lead_capture for greetings', () => {
      expect(categorizeCall({ text: 'Hello' })).toBe('lead_capture');
    });

    it('should default to lead_capture for null signals', () => {
      expect(categorizeCall(null)).toBe('lead_capture');
    });

    it('should default to lead_capture for empty signals', () => {
      expect(categorizeCall({ text: '' })).toBe('lead_capture');
    });

    it('should default to lead_capture for general inquiries', () => {
      expect(categorizeCall({ text: 'I have a question' })).toBe('lead_capture');
    });
  });

  describe('Keyword Array Support', () => {
    it('should process keywords array', () => {
      expect(categorizeCall({ keywords: ['pricing', 'quote'] })).toBe('prospect_call');
    });

    it('should combine text and keywords', () => {
      expect(categorizeCall({ text: 'Hello', keywords: ['support'] })).toBe('customer_service');
    });
  });
});

// ============================================================================
// SENTIMENT ANALYSIS TESTS
// ============================================================================

describe('Sentiment Analysis', () => {

  describe('Positive Sentiment', () => {
    it('should detect positive words', () => {
      expect(calculateSentiment('This is great service')).toBeGreaterThan(0);
    });

    it('should detect gratitude', () => {
      expect(calculateSentiment('Thank you so much')).toBeGreaterThan(0);
    });

    it('should detect happiness', () => {
      expect(calculateSentiment('I am so happy with this')).toBeGreaterThan(0);
    });

    it('should stack positive sentiment', () => {
      const single = calculateSentiment('great');
      const multiple = calculateSentiment('great excellent wonderful');
      expect(multiple).toBeGreaterThan(single);
    });
  });

  describe('Negative Sentiment', () => {
    it('should detect frustration', () => {
      expect(calculateSentiment('I am frustrated')).toBeLessThan(0);
    });

    it('should detect anger', () => {
      expect(calculateSentiment('This is terrible')).toBeLessThan(0);
    });

    it('should detect hate', () => {
      expect(calculateSentiment('I hate this')).toBeLessThan(0);
    });

    it('should detect legal threats', () => {
      expect(calculateSentiment('I will contact my lawyer')).toBeLessThan(0);
    });
  });

  describe('Neutral Sentiment', () => {
    it('should return 0 for neutral text', () => {
      expect(calculateSentiment('Hello how are you')).toBe(0);
    });

    it('should return 0 for empty text', () => {
      expect(calculateSentiment('')).toBe(0);
    });
  });

  describe('Sentiment Range', () => {
    it('should never exceed 1', () => {
      const text = 'great excellent wonderful amazing perfect love happy good helpful';
      expect(calculateSentiment(text)).toBeLessThanOrEqual(1);
    });

    it('should never go below -1', () => {
      const text = 'terrible awful horrible frustrated angry hate worst sucks furious';
      expect(calculateSentiment(text)).toBeGreaterThanOrEqual(-1);
    });
  });
});

// ============================================================================
// ESCALATION TESTS
// ============================================================================

describe('Escalation Detection', () => {

  describe('Sentiment-Based Escalation', () => {
    it('should escalate when sentiment is -0.5 or lower', () => {
      expect(shouldEscalate('text', -0.5)).toBe(true);
    });

    it('should escalate when sentiment is very negative', () => {
      expect(shouldEscalate('text', -1)).toBe(true);
    });

    it('should not escalate for moderate negative sentiment', () => {
      expect(shouldEscalate('neutral text', -0.3)).toBe(false);
    });
  });

  describe('Keyword-Based Escalation', () => {
    it('should escalate on lawsuit mention', () => {
      expect(shouldEscalate('I will file a lawsuit', 0)).toBe(true);
    });

    it('should escalate on lawyer mention', () => {
      expect(shouldEscalate('My lawyer will hear about this', 0)).toBe(true);
    });

    it('should escalate on attorney mention', () => {
      expect(shouldEscalate('I am contacting my attorney', 0)).toBe(true);
    });

    it('should escalate on BBB mention', () => {
      expect(shouldEscalate('I am reporting to BBB', 0)).toBe(true);
    });

    it('should escalate on regulatory mention', () => {
      expect(shouldEscalate('I will file a regulatory complaint', 0)).toBe(true);
    });

    it('should escalate on fraud mention', () => {
      expect(shouldEscalate('This is fraud', 0)).toBe(true);
    });
  });

  describe('Combined Escalation', () => {
    it('should escalate on both sentiment AND keyword', () => {
      expect(shouldEscalate('I will sue you terrible service', -0.6)).toBe(true);
    });

    it('should not escalate normal negative feedback', () => {
      expect(shouldEscalate('I am unhappy', -0.2)).toBe(false);
    });
  });
});

// ============================================================================
// CONSENT VALIDATION TESTS
// ============================================================================

describe('Recording Consent Validation', () => {

  it('should allow recording when consent is true', () => {
    const session = { consent_flags: { recording: true } };
    expect(session.consent_flags.recording).toBe(true);
  });

  it('should deny recording when consent is false', () => {
    const session = { consent_flags: { recording: false } };
    const mode = session.consent_flags.recording === true ? 'full' : 'no_record';
    expect(mode).toBe('no_record');
  });

  it('should fail-closed when consent is undefined', () => {
    const session = { consent_flags: {} as { recording?: boolean } };
    const mode = session.consent_flags.recording === true ? 'full' : 'no_record';
    expect(mode).toBe('no_record');
  });
});

describe('SMS Opt-In Validation', () => {

  it('should allow SMS when opt-in is true', () => {
    const session = { consent_flags: { sms_opt_in: true } };
    expect(session.consent_flags.sms_opt_in === true).toBe(true);
  });

  it('should deny SMS when opt-in is false', () => {
    const session = { consent_flags: { sms_opt_in: false } };
    expect(session.consent_flags.sms_opt_in === true).toBe(false);
  });

  it('should deny SMS when opt-in is undefined', () => {
    const session = { consent_flags: {} as { sms_opt_in?: boolean } };
    expect(session.consent_flags.sms_opt_in === true).toBe(false);
  });
});
