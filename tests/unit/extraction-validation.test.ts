import { describe, it, expect } from 'vitest';
import {
  documentClassificationSchema,
  extractedTimetableEntrySchema,
  timetableExtractionSchema,
  extractedCalendarEventSchema,
  calendarExtractionSchema,
  confirmTimetableExtractionSchema,
  confirmCalendarExtractionSchema,
} from '@/lib/validation';
import { DocumentProcessingService } from '@/server/services/document-processing.service';
import type { TimetableExtraction, CalendarExtraction } from '@/lib/validation';

describe('AI Extraction Schemas & Domain Validation', () => {
  describe('documentClassificationSchema', () => {
    it('accepts valid document classifications with confidence', () => {
      const validTypes = ['timetable', 'calendar', 'mixed', 'unknown'] as const;
      for (const type of validTypes) {
        const result = documentClassificationSchema.safeParse({
          document_type: type,
          confidence: 0.95,
          reasoning: `Identified as ${type} based on structure and header`,
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid document type', () => {
      const result = documentClassificationSchema.safeParse({
        document_type: 'resume',
        confidence: 0.8,
        reasoning: 'Not an academic document',
      });
      expect(result.success).toBe(false);
    });

    it('clamps or rejects out-of-range confidence scores', () => {
      const resultOver = documentClassificationSchema.safeParse({
        document_type: 'timetable',
        confidence: 1.5,
      });
      expect(resultOver.success).toBe(false);

      const resultNegative = documentClassificationSchema.safeParse({
        document_type: 'timetable',
        confidence: -0.2,
      });
      expect(resultNegative.success).toBe(false);
    });
  });

  describe('extractedTimetableEntrySchema', () => {
    it('validates a complete timetable entry', () => {
      const result = extractedTimetableEntrySchema.safeParse({
        day_of_week: 'monday',
        start_time: '09:00',
        end_time: '10:30',
        subject_name: 'Database Systems',
        subject_code: 'CS401',
        faculty_name: 'Dr. Ramesh Sharma',
        room: 'Lab 302',
        class_type: 'lab',
        section: 'A',
        notes: 'Bring laptops',
        confidence: 0.92,
        warnings: [],
      });
      expect(result.success).toBe(true);
    });

    it('allows null for optional/unclear fields without inventing data', () => {
      const result = extractedTimetableEntrySchema.safeParse({
        day_of_week: 'wednesday',
        start_time: '14:00',
        end_time: '15:00',
        subject_name: 'Discrete Mathematics',
        subject_code: null,
        faculty_name: null,
        room: null,
        class_type: 'lecture',
        section: null,
        notes: null,
        confidence: 0.78,
        warnings: ['Room number unclear in scanned document'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.room).toBeNull();
        expect(result.data.faculty_name).toBeNull();
      }
    });

    it('rejects invalid time format', () => {
      const result = extractedTimetableEntrySchema.safeParse({
        day_of_week: 'friday',
        start_time: '9am',
        end_time: '10:00',
        subject_name: 'Physics',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid weekday', () => {
      const result = extractedTimetableEntrySchema.safeParse({
        day_of_week: 'funday',
        start_time: '09:00',
        end_time: '10:00',
        subject_name: 'Physics',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('timetableExtractionSchema', () => {
    it('validates a full timetable extraction payload', () => {
      const payload: TimetableExtraction = {
        timetable_title: 'B.Tech CSE Semester 4 Timetable',
        academic_year: '2026-2027',
        semester: 4,
        section: 'A',
        branch: 'Computer Science & Engineering',
        timezone: 'Asia/Kolkata',
        confidence: 0.9,
        warnings: [],
        entries: [
          {
            day_of_week: 'monday',
            start_time: '09:00',
            end_time: '10:00',
            subject_name: 'Algorithms',
            subject_code: 'CS402',
            faculty_name: 'Prof. Gupta',
            room: 'LT-1',
            class_type: 'lecture',
            section: 'A',
            notes: null,
            confidence: 0.95,
            warnings: [],
          },
          {
            day_of_week: 'monday',
            start_time: '10:00',
            end_time: '11:00',
            subject_name: 'Computer Networks',
            subject_code: 'CS403',
            faculty_name: 'Dr. Neha Rao',
            room: 'LT-1',
            class_type: 'lecture',
            section: 'A',
            notes: null,
            confidence: 0.88,
            warnings: [],
          },
        ],
      };

      const result = timetableExtractionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects extraction without entries array', () => {
      const result = timetableExtractionSchema.safeParse({
        timetable_title: 'Empty Timetable',
        confidence: 0.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('extractedCalendarEventSchema & calendarExtractionSchema', () => {
    it('validates academic calendar event with date and flags', () => {
      const result = extractedCalendarEventSchema.safeParse({
        event_date: '2026-10-02',
        title: 'Gandhi Jayanti',
        event_type: 'holiday',
        description: 'National Holiday',
        is_holiday: true,
        is_teaching_day: false,
        affects_regular_schedule: true,
        confidence: 0.99,
        warnings: [],
      });
      expect(result.success).toBe(true);
    });

    it('validates full academic calendar extraction', () => {
      const payload: CalendarExtraction = {
        calendar_title: 'Autumn 2026 Academic Calendar',
        academic_year: '2026-2027',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        confidence: 0.94,
        warnings: [],
        events: [
          {
            event_date: '2026-08-03',
            title: 'Commencement of Classes',
            event_type: 'teaching_day',
            description: 'First teaching day of Odd semester',
            is_holiday: false,
            is_teaching_day: true,
            affects_regular_schedule: true,
            metadata: {},
            confidence: 0.95,
            warnings: [],
          },
          {
            event_date: '2026-08-15',
            title: 'Independence Day',
            event_type: 'holiday',
            description: 'National Holiday',
            is_holiday: true,
            is_teaching_day: false,
            affects_regular_schedule: true,
            metadata: {},
            confidence: 1.0,
            warnings: [],
          },
        ],
      };

      const result = calendarExtractionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects invalid event_type in extracted calendar event', () => {
      const result = extractedCalendarEventSchema.safeParse({
        event_date: '2026-08-15',
        title: 'Independence Day',
        event_type: 'birthday_party', // invalid
        is_holiday: true,
        is_teaching_day: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Domain-Level Validation: Timetable Rules', () => {
    it('flags error when start_time >= end_time', () => {
      const rawExtraction: TimetableExtraction = {
        timetable_title: 'Faulty Timetable',
        confidence: 0.8,
        timezone: 'Asia/Kolkata',
        warnings: [],
        entries: [
          {
            day_of_week: 'monday',
            start_time: '14:00',
            end_time: '13:00', // invalid chronological order
            subject_name: 'Chemistry Lab',
            subject_code: null,
            faculty_name: null,
            room: null,
            class_type: 'lab',
            section: null,
            notes: null,
            confidence: 0.8,
            warnings: [],
          },
        ],
      };

      const validated = DocumentProcessingService.validateTimetableDomainRules(rawExtraction);
      expect(validated.isValid).toBe(false);
      expect(validated.errors.length).toBeGreaterThan(0);
      expect(validated.errors[0]).toContain('start (14:00) is after end (13:00)');
    });

    it('detects and flags overlapping classes on the same day', () => {
      const rawExtraction: TimetableExtraction = {
        timetable_title: 'Overlapping Timetable',
        confidence: 0.85,
        timezone: 'Asia/Kolkata',
        warnings: [],
        entries: [
          {
            day_of_week: 'tuesday',
            start_time: '10:00',
            end_time: '11:30',
            subject_name: 'Operating Systems',
            subject_code: null,
            faculty_name: null,
            room: 'Room 101',
            class_type: 'lecture',
            section: null,
            notes: null,
            confidence: 0.9,
            warnings: [],
          },
          {
            day_of_week: 'tuesday',
            start_time: '11:00', // overlaps with 10:00-11:30
            end_time: '12:00',
            subject_name: 'Computer Networks',
            subject_code: null,
            faculty_name: null,
            room: 'Room 102',
            class_type: 'lecture',
            section: null,
            notes: null,
            confidence: 0.9,
            warnings: [],
          },
        ],
      };

      const validated = DocumentProcessingService.validateTimetableDomainRules(rawExtraction);
      expect(validated.conflictCount).toBe(1);
      expect(validated.warnings.some((w) => w.includes('Time overlap detected on tuesday'))).toBe(true);
    });

    it('flags low confidence entries below 0.75 for human review', () => {
      const rawExtraction: TimetableExtraction = {
        timetable_title: 'Low Confidence Timetable',
        confidence: 0.7,
        timezone: 'Asia/Kolkata',
        warnings: [],
        entries: [
          {
            day_of_week: 'friday',
            start_time: '15:00',
            end_time: '16:00',
            subject_name: 'Software Eng',
            subject_code: null,
            faculty_name: null,
            room: null,
            class_type: 'lecture',
            section: null,
            notes: null,
            confidence: 0.62, // low confidence
            warnings: [],
          },
        ],
      };

      const validated = DocumentProcessingService.validateTimetableDomainRules(rawExtraction);
      expect(validated.warnings.some((w) => w.includes('Low confidence extraction for "Software Eng"'))).toBe(true);
      expect(validated.warnings.some((w) => w.includes('No room assigned for "Software Eng"'))).toBe(true);
    });
  });

  describe('Domain-Level Validation: Calendar Rules', () => {
    it('flags contradictory holiday and teaching day flags', () => {
      const rawExtraction: CalendarExtraction = {
        calendar_title: 'Contradictory Calendar',
        effective_from: '2026-08-01',
        confidence: 0.8,
        warnings: [],
        events: [
          {
            event_date: '2026-09-05',
            title: 'Teachers Day',
            event_type: 'holiday',
            is_holiday: true,
            is_teaching_day: true, // Contradictory: holiday AND teaching day
            affects_regular_schedule: true,
            metadata: {},
            confidence: 0.8,
            warnings: [],
          },
        ],
      };

      const validated = DocumentProcessingService.validateCalendarDomainRules(rawExtraction);
      expect(validated.warnings.some((w) => w.includes('marked as both a holiday and a teaching day'))).toBe(true);
    });
  });

  describe('Confirmation Payload Validation', () => {
    it('validates confirmTimetableExtractionSchema', () => {
      const result = confirmTimetableExtractionSchema.safeParse({
        name: 'CSE Spring 2026 Final',
        effective_from: '2026-08-01',
        timezone: 'Asia/Kolkata',
        active: true,
        entries: [
          {
            day_of_week: 'monday',
            start_time: '09:00',
            end_time: '10:00',
            subject_name: 'Data Structures',
            subject_code: 'CS201',
            faculty_name: 'Dr. Rao',
            room: '101',
            class_type: 'lecture',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects confirmation with empty entries array', () => {
      const result = confirmTimetableExtractionSchema.safeParse({
        name: 'Empty',
        effective_from: '2026-08-01',
        entries: [],
      });
      expect(result.success).toBe(false);
    });

    it('validates confirmCalendarExtractionSchema', () => {
      const result = confirmCalendarExtractionSchema.safeParse({
        name: 'Academic Year 2026-2027 Calendar',
        effective_from: '2026-08-01',
        effective_to: '2027-05-31',
        active: true,
        events: [
          {
            event_date: '2026-08-15',
            title: 'Independence Day',
            event_type: 'holiday',
            is_holiday: true,
            is_teaching_day: false,
            affects_regular_schedule: true,
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
