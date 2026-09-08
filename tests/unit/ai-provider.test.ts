import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockDocumentAIProvider } from '@/server/services/ai/mock-document-ai.provider';
import { GeminiDocumentAIProvider } from '@/server/services/ai/gemini-document-ai.provider';
import { getAIProvider, setCustomAIProvider } from '@/server/services/ai/ai-provider.factory';
import { timetableExtractionSchema, calendarExtractionSchema } from '@/lib/validation';
import { ERROR_CODES } from '@/lib/constants/extraction';

describe('AI Provider Abstraction & Providers', () => {
  const dummyBuffer = Buffer.from('mock-document-content');
  const dummyMime = 'image/png';

  describe('MockDocumentAIProvider', () => {
    let mockProvider: MockDocumentAIProvider;

    beforeEach(() => {
      mockProvider = new MockDocumentAIProvider();
    });

    it('classifies document as timetable by default', async () => {
      const result = await mockProvider.classifyDocument(dummyBuffer, dummyMime);
      expect(result.document_type).toBe('timetable');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reasoning).toBeDefined();
    });

    it('supports custom classification override', async () => {
      mockProvider.classificationOverride = {
        document_type: 'calendar',
        confidence: 0.88,
        reasoning: 'Academic year schedule dates visible',
      };

      const result = await mockProvider.classifyDocument(dummyBuffer, dummyMime);
      expect(result.document_type).toBe('calendar');
      expect(result.confidence).toBe(0.88);
    });

    it('extracts realistic timetable data matching timetableExtractionSchema', async () => {
      const result = await mockProvider.extractTimetable(dummyBuffer, dummyMime);

      const validation = timetableExtractionSchema.safeParse(result);
      expect(validation.success).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.some((e) => e.class_type === 'lab')).toBe(true);
      expect(result.entries.some((e) => e.subject_name.includes('Data Structures'))).toBe(true);
    });

    it('extracts realistic academic calendar matching calendarExtractionSchema', async () => {
      const result = await mockProvider.extractAcademicCalendar(dummyBuffer, dummyMime);

      const validation = calendarExtractionSchema.safeParse(result);
      expect(validation.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.some((e) => e.event_type === 'holiday' && e.is_holiday)).toBe(true);
      expect(result.events.some((e) => e.event_type === 'working_day')).toBe(true);
      expect(result.events.some((e) => e.event_type === 'exam')).toBe(true);
    });

    it('simulates rate limit error (429)', async () => {
      mockProvider.simulatedFailure = ERROR_CODES.AI_RATE_LIMIT;

      await expect(mockProvider.extractTimetable(dummyBuffer, dummyMime)).rejects.toThrowError(
        expect.objectContaining({
          code: ERROR_CODES.AI_RATE_LIMIT,
          statusCode: 429,
        })
      );
    });

    it('simulates AI timeout error (504)', async () => {
      mockProvider.simulatedFailure = ERROR_CODES.AI_TIMEOUT;

      await expect(mockProvider.extractTimetable(dummyBuffer, dummyMime)).rejects.toThrowError(
        expect.objectContaining({
          code: ERROR_CODES.AI_TIMEOUT,
          statusCode: 504,
        })
      );
    });

    it('simulates schema mismatch error (502)', async () => {
      mockProvider.simulatedFailure = ERROR_CODES.SCHEMA_MISMATCH;

      await expect(mockProvider.extractTimetable(dummyBuffer, dummyMime)).rejects.toThrowError(
        expect.objectContaining({
          code: ERROR_CODES.SCHEMA_MISMATCH,
          statusCode: 502,
        })
      );
    });
  });

  describe('GeminiDocumentAIProvider Safe Configuration', () => {
    const originalApiKey = process.env.GEMINI_API_KEY;

    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    afterEach(() => {
      if (originalApiKey) {
        process.env.GEMINI_API_KEY = originalApiKey;
      }
    });

    it('throws AppError AI_API_KEY_MISSING with 503 if API key is not in environment', async () => {
      const provider = new GeminiDocumentAIProvider(undefined);

      await expect(provider.classifyDocument(dummyBuffer, dummyMime)).rejects.toThrowError(
        expect.objectContaining({
          code: ERROR_CODES.AI_API_KEY_MISSING,
          statusCode: 503,
        })
      );
    });
  });

  describe('AI Provider Factory', () => {
    afterEach(() => {
      setCustomAIProvider(null);
    });

    it('returns MockDocumentAIProvider in test environment', () => {
      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(MockDocumentAIProvider);
    });

    it('allows setting a custom provider mock', () => {
      const customMock = new MockDocumentAIProvider();
      customMock.classificationOverride = {
        document_type: 'mixed',
        confidence: 0.99,
      };

      setCustomAIProvider(customMock);
      const provider = getAIProvider();
      expect(provider).toBe(customMock);
    });
  });
});
