import { getEmpathyCue, getSentimentScore, SentimentResult } from './sentimentService';
import { generateSpeech, VoiceOptions, VoiceResponse } from './voiceService';

export interface EmpatheticResponse {
  sentiment: SentimentResult;
  empatheticText: string;
}

/**
 * Injects an empathy cue ahead of the response based on sentiment.
 */
export function buildEmpatheticText(transcript: string, baseResponse: string): EmpatheticResponse {
  const sentiment = getSentimentScore(transcript || '');
  const cue = getEmpathyCue(sentiment.category);
  const empatheticText = `${cue}${baseResponse}`.trim();
  return { sentiment, empatheticText };
}

/**
 * High-level helper: analyze sentiment, prepend empathy cue, and synthesize speech.
 * Intended for server-side usage (voiceService enforces server-only).
 */
export async function synthesizeEmpatheticSpeech(
  transcript: string,
  baseResponse: string,
  options?: VoiceOptions
): Promise<{ voice: VoiceResponse; sentiment: SentimentResult; text: string }> {
  let empatheticText: string;
  let sentiment: SentimentResult;

  try {
    ({ sentiment, empatheticText } = buildEmpatheticText(transcript, baseResponse));
  } catch (error) {
    throw new Error(
      `Sentiment analysis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let voice: VoiceResponse;
  try {
    voice = await generateSpeech(empatheticText, options);
  } catch (error) {
    throw new Error(
      `Speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { voice, sentiment, text: empatheticText };
}
