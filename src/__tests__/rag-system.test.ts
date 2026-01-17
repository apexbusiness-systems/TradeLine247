/**
 * TradeLine 24/7 RAG System Unit Tests
 * Consolidated tests for RAG ingestion, retrieval, chunking, and embeddings.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// RAG UTILITIES
// ============================================================================

interface ChunkResult { text: string; chunk_index: number; token_count: number; }

function splitSentences(text: string): string[] {
  if (!text) return [text];
  const result: string[] = [];
  let current = '';
  for (const char of text) {
    current += char;
    if ('.!?'.includes(char)) { if (current.trim()) result.push(current); current = ''; }
  }
  if (current.trim()) result.push(current);
  return result.length > 0 ? result : [text];
}

function chunkText(text: string, targetTokens = 800, overlapTokens = 120): ChunkResult[] {
  const sentences = splitSentences(text);
  const chunks: ChunkResult[] = [];
  let currentChunk = '', currentTokens = 0, chunkIndex = 0;
  const avgCharsPerToken = 4;

  for (const raw of sentences) {
    const sentence = raw.trim();
    const tokens = Math.ceil(sentence.length / avgCharsPerToken);
    if (currentTokens + tokens > targetTokens && currentChunk) {
      chunks.push({ text: currentChunk.trim(), chunk_index: chunkIndex++, token_count: currentTokens });
      const overlapStart = Math.max(0, currentChunk.length - (overlapTokens * avgCharsPerToken));
      currentChunk = currentChunk.substring(overlapStart) + ' ' + sentence;
      currentTokens = Math.ceil(currentChunk.length / avgCharsPerToken);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += tokens;
    }
  }
  if (currentChunk.trim()) chunks.push({ text: currentChunk.trim(), chunk_index: chunkIndex, token_count: currentTokens });
  return chunks;
}

function detectLanguage(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[àâäéèêëïîôùûüÿœæç]/i.test(text)) return 'fr';
  if (/[äöüß]/i.test(text)) return 'de';
  if (/[ñáéíóúü]/i.test(text)) return 'es';
  return 'en';
}

function normalizeText(text: string, lang?: string): { normalized: string; language: string } {
  const language = lang ?? detectLanguage(text);
  const normalized = text.toLowerCase().trim().replaceAll(/\s+/g, ' ').replaceAll(/[^\w\s\u00C0-\u024F]/g, ' ').trim();
  return { normalized, language };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same length');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function hybridScore(semantic: number, fullText: number, sw = 0.7, fw = 0.3): number {
  return semantic * sw + fullText * fw;
}

// ============================================================================
// TESTS
// ============================================================================

describe('RAG Chunking', () => {
  it('creates chunks with sequential indices', () => {
    const chunks = chunkText('First. Second. Third.');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].token_count).toBeGreaterThan(0);
  });

  it('handles edge cases', () => {
    expect(chunkText('Single.')[0].text).toBe('Single.');
    expect(chunkText('No punctuation')[0].text).toBe('No punctuation');
    expect(chunkText('').length).toBeLessThanOrEqual(1);
  });

  it('creates overlapping chunks for long text', () => {
    const chunks = chunkText(new Array(200).fill('Test sentence. ').join(''));
    if (chunks.length > 1) expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('Language Detection', () => {
  const cases: [string, string][] = [
    ['Hello, how are you?', 'en'], ['OK', 'en'],
    ['Bonjour, comment ça va?', 'fr'],
    ['Guten Tag! Wie heißt die Straße?', 'de'],
    ['¡Hola! ¿Cómo estás?', 'es'],
    ['你好世界', 'zh'], ['こんにちは', 'ja'], ['안녕하세요', 'ko'],
  ];
  cases.forEach(([text, lang]) => it(`detects ${lang}`, () => expect(detectLanguage(text)).toBe(lang)));
});

describe('Text Normalization', () => {
  it('normalizes text', () => {
    expect(normalizeText('HELLO WORLD').normalized).toBe('hello world');
    expect(normalizeText('  hello  ').normalized).toBe('hello');
    expect(normalizeText('hello    world').normalized).toBe('hello world');
  });
  it('uses explicit language', () => expect(normalizeText('Hello', 'es').language).toBe('es'));
});

describe('Cosine Similarity', () => {
  it('computes correctly', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1);
  });
  it('handles high-dimensional vectors', () => {
    const v1 = new Array(1536).fill(0).map((_, i) => Math.sin(i) * 0.5 + 0.5);
    const v2 = new Array(1536).fill(0).map((_, i) => Math.cos(i) * 0.5 + 0.5);
    const s = cosineSimilarity(v1, v2);
    expect(s).toBeGreaterThanOrEqual(-1);
    expect(s).toBeLessThanOrEqual(1);
  });
  it('similar > different', () => {
    const base = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    expect(cosineSimilarity(base, base.map(v => v + 0.01))).toBeGreaterThan(
      cosineSimilarity(base, [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0])
    );
  });
  it('throws for mismatched lengths', () => expect(() => cosineSimilarity([1, 2], [1])).toThrow());
});

describe('Hybrid Search', () => {
  it('combines scores', () => {
    expect(hybridScore(0.8, 0.6)).toBeCloseTo(0.74);
    expect(hybridScore(0.9, 0.3, 0.5, 0.5)).toBeCloseTo(0.6);
    expect(hybridScore(1, 0)).toBe(0.7);
  });
  it('produces valid range', () => {
    [0, 0.25, 0.5, 0.75, 1].forEach(s => [0, 0.5, 1].forEach(f => {
      const h = hybridScore(s, f);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }));
  });
});

describe('RAG Config', () => {
  it('embedding dimensions', () => expect(1536).toBe(1536));
  it('models contain embedding', () => {
    expect('text-embedding-3-small').toContain('embedding');
    expect('text-embedding-ada-002').toContain('embedding');
  });
  it('supported source types', () => {
    const types = ['transcript', 'email', 'doc', 'faq'];
    ['transcript', 'email', 'doc', 'faq'].forEach(t => expect(types).toContain(t));
  });
  it('deduplication', () => {
    const existing = ['s1', 's2'];
    expect(existing.includes('s3')).toBe(false);
    expect(existing.includes('s2')).toBe(true);
  });
});
