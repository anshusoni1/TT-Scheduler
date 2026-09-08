import { describe, it, expect } from 'vitest';
import { timetableExtractionSchema, calendarExtractionSchema } from '@/lib/validation';
import timetableRepresentative from '../fixtures/timetable-representative.json';
import calendarRepresentative from '../fixtures/academic-calendar-representative.json';
import ambiguousDocument from '../fixtures/ambiguous-document.json';
import malformedAiResponse from '../fixtures/malformed-ai-response.json';

describe('Fixtures and Schema Robustness Tests', () => {
  it('validates representative timetable fixture successfully', () => {
    const parsed = timetableExtractionSchema.safeParse(timetableRepresentative);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.entries).toHaveLength(5);
      expect(parsed.data.confidence).toBe(0.96);
      expect(parsed.data.academic_year).toBe('2026-2027');
    }
  });

  it('validates representative academic calendar fixture successfully', () => {
    const parsed = calendarExtractionSchema.safeParse(calendarRepresentative);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.events).toHaveLength(6);
      expect(parsed.data.confidence).toBe(0.94);
      expect(parsed.data.effective_from).toBe('2026-08-01');
    }
  });

  it('validates ambiguous extraction fixture and flags low confidence', () => {
    const parsed = timetableExtractionSchema.safeParse(ambiguousDocument);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.confidence).toBeLessThan(0.7);
      expect(parsed.data.warnings).toHaveLength(3);
    }
  });

  it('strictly rejects malformed extraction response', () => {
    const parsed = timetableExtractionSchema.safeParse(malformedAiResponse);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errorStrings = parsed.error.issues.map((i) => i.path.join('.'));
      expect(errorStrings.length).toBeGreaterThan(0);
    }
  });
});
