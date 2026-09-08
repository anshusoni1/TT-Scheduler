import { describe, it, expect } from 'vitest';
import {
  profileUpdateSchema,
  academicYearSchema,
  timetableEntrySchema,
  timetableSchema,
  calendarEventSchema,
  academicCalendarSchema,
  scheduleExceptionSchema,
  documentUploadSchema,
} from '@/lib/validation';

describe('Validation Schemas (Zod)', () => {
  describe('profileUpdateSchema', () => {
    it('accepts valid student profile', () => {
      const result = profileUpdateSchema.safeParse({
        name: 'Alex Johnson',
        college: 'National Engineering College',
        course: 'B.Tech',
        branch: 'Computer Science',
        semester: 4,
        section: 'A',
        timezone: 'Asia/Kolkata',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = profileUpdateSchema.safeParse({
        name: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid semester out of bounds', () => {
      const result = profileUpdateSchema.safeParse({
        name: 'Alex',
        semester: 20, // out of 1-16
      });
      expect(result.success).toBe(false);
    });
  });

  describe('academicYearSchema', () => {
    it('accepts valid academic cycle with start_date <= end_date', () => {
      const result = academicYearSchema.safeParse({
        name: '2026-2027',
        start_date: '2026-08-01',
        end_date: '2027-05-31',
        semester: 5,
        is_active: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects when start_date is after end_date', () => {
      const result = academicYearSchema.safeParse({
        name: 'Invalid Year',
        start_date: '2027-01-01',
        end_date: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-ISO date formats', () => {
      const result = academicYearSchema.safeParse({
        name: '2026',
        start_date: '01/08/2026',
        end_date: '31/05/2027',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('timetableEntrySchema', () => {
    it('accepts valid timetable entry slot', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'monday',
        start_time: '09:00',
        end_time: '10:00',
        subject_name: 'Database Management Systems',
        subject_code: 'CS401',
        faculty_name: 'Dr. Smith',
        room: 'Lab 3',
        class_type: 'lab',
      });
      expect(result.success).toBe(true);
    });

    it('accepts seconds in time format', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'wednesday',
        start_time: '14:30:00',
        end_time: '16:00:00',
        subject_name: 'Algorithms',
      });
      expect(result.success).toBe(true);
    });

    it('rejects when start_time equals end_time', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'friday',
        start_time: '10:00',
        end_time: '10:00',
        subject_name: 'Mathematics',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when start_time is greater than end_time', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'friday',
        start_time: '12:00',
        end_time: '11:00',
        subject_name: 'Physics',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid day of week', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'someday',
        start_time: '09:00',
        end_time: '10:00',
        subject_name: 'Chemistry',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid class type', () => {
      const result = timetableEntrySchema.safeParse({
        day_of_week: 'tuesday',
        start_time: '09:00',
        end_time: '10:00',
        subject_name: 'History',
        class_type: 'extracurricular',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('timetableSchema', () => {
    it('accepts valid timetable with effective_from <= effective_to', () => {
      const result = timetableSchema.safeParse({
        name: 'Monsoon 2026 Timetable',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        active: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects when effective_from is after effective_to', () => {
      const result = timetableSchema.safeParse({
        name: 'Inverted Timetable',
        effective_from: '2026-12-31',
        effective_to: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('calendarEventSchema', () => {
    it('accepts valid holiday event', () => {
      const result = calendarEventSchema.safeParse({
        event_date: '2026-10-02',
        event_type: 'holiday',
        title: 'National Holiday',
        is_holiday: true,
        is_teaching_day: false,
        affects_regular_schedule: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts special teaching day event', () => {
      const result = calendarEventSchema.safeParse({
        event_date: '2026-10-10',
        event_type: 'special_teaching_day',
        title: 'Saturday Working Day',
        is_holiday: false,
        is_teaching_day: true,
        affects_regular_schedule: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid event type', () => {
      const result = calendarEventSchema.safeParse({
        event_date: '2026-10-10',
        event_type: 'vacation_party',
        title: 'Invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('academicCalendarSchema', () => {
    it('accepts valid academic calendar with effective date range', () => {
      const result = academicCalendarSchema.safeParse({
        name: 'Institute Academic Calendar 2026-27',
        effective_from: '2026-07-15',
        effective_to: '2027-06-30',
        active: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects academic calendar with effective_from after effective_to', () => {
      const result = academicCalendarSchema.safeParse({
        name: 'Bad Calendar',
        effective_from: '2027-06-30',
        effective_to: '2026-07-15',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('scheduleExceptionSchema', () => {
    it('accepts class cancellation exception', () => {
      const result = scheduleExceptionSchema.safeParse({
        date: '2026-09-15',
        exception_type: 'cancelled',
        reason: 'Faculty on academic leave',
      });
      expect(result.success).toBe(true);
    });

    it('accepts room change exception with time range', () => {
      const result = scheduleExceptionSchema.safeParse({
        date: '2026-09-15',
        exception_type: 'room_change',
        start_time: '10:00',
        end_time: '11:00',
        room: 'Auditorium B',
        reason: 'Maintenance in primary room',
      });
      expect(result.success).toBe(true);
    });

    it('rejects exception when start_time >= end_time', () => {
      const result = scheduleExceptionSchema.safeParse({
        date: '2026-09-15',
        exception_type: 'rescheduled',
        start_time: '14:00',
        end_time: '13:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('documentUploadSchema', () => {
    it('accepts valid PDF document within 10MB', () => {
      const result = documentUploadSchema.safeParse({
        file_name: 'Semester_4_Timetable.pdf',
        mime_type: 'application/pdf',
        file_size: 2 * 1024 * 1024, // 2MB
        document_type: 'timetable',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid JPEG image', () => {
      const result = documentUploadSchema.safeParse({
        file_name: 'calendar_scan.jpg',
        mime_type: 'image/jpeg',
        file_size: 1024 * 500,
        document_type: 'calendar',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unsupported file type (.exe, .docx, .txt)', () => {
      const result = documentUploadSchema.safeParse({
        file_name: 'timetable.docx',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: 1024,
      });
      expect(result.success).toBe(false);
    });

    it('rejects oversized file (> 10MB)', () => {
      const result = documentUploadSchema.safeParse({
        file_name: 'huge_scan.pdf',
        mime_type: 'application/pdf',
        file_size: 11 * 1024 * 1024, // 11MB
      });
      expect(result.success).toBe(false);
    });
  });
});
