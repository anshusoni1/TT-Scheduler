import { describe, it, expect } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadEnvLocalKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/);
      if (match) return match[1];
    }
  } catch {
    // Ignore
  }
  return undefined;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

describe('Live Gemini 3.5 Flash API Connection', () => {
  it('connects to Gemini and returns structured response with configured key', async () => {
    const key = loadEnvLocalKey();
    if (!key) {
      console.log('Skipping live Gemini test: GEMINI_API_KEY not configured.');
      return;
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: 'Respond with JSON only: {"status": "success", "platform": "ClassFlow", "model": "gemini-3.5-flash"}',
        config: {
          responseMimeType: 'application/json',
        },
      });
    }, 2, 2500);

    expect(response.text).toBeDefined();
    const parsed = JSON.parse(response.text || '{}');
    expect(parsed.status).toBe('success');
    expect(parsed.platform).toBe('ClassFlow');
  }, 35000);

  it('classifies a document through GeminiDocumentAIProvider with real API', async () => {
    const key = loadEnvLocalKey();
    if (!key) return;

    const { GeminiDocumentAIProvider } = await import('@/server/services/ai/gemini-document-ai.provider');
    const provider = new GeminiDocumentAIProvider(key);

    const sampleImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const classification = await retryWithBackoff(async () => {
      return await provider.classifyDocument(sampleImage, 'image/png');
    }, 2, 2500);

    expect(classification).toBeDefined();
    expect(['timetable', 'calendar', 'mixed', 'unknown']).toContain(classification.document_type);
    expect(classification.confidence).toBeGreaterThanOrEqual(0);
    expect(classification.confidence).toBeLessThanOrEqual(1);
  }, 35000);
});
