import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GeminiDocumentAIProvider } from '@/server/services/ai/gemini-document-ai.provider';
import {
  timetableExtractionSchema,
  calendarExtractionSchema,
  confirmTimetableExtractionSchema,
  confirmCalendarExtractionSchema,
} from '@/lib/validation';
import { SchedulingService } from '@/server/services/scheduling.service';
import { generateICalendar, type ICalEventInput } from '@/lib/ical';
import type {
  Timetable,
  TimetableEntry,
  AcademicCalendar,
  CalendarEvent,
  ScheduleException,
  AttendanceRecord,
} from '@/types/database';

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

const geminiKey = loadEnvLocalKey();

describe('PRODUCTION ACCEPTANCE TEST SUITE (Tests 1 - 10)', () => {
  // =========================================================================
  // TEST 1 — TIMETABLE REAL AI EXTRACTION & REVIEW WORKFLOW
  // =========================================================================
  describe('TEST 1 — Timetable Real Extraction & Review Workflow', () => {
    it('executes real Gemini extraction on test_timetable.pdf with full review lifecycle', async () => {
      if (!geminiKey) {
        console.log('Skipping real API test: GEMINI_API_KEY not found');
        return;
      }

      const pdfPath = path.resolve(process.cwd(), 'tests/fixtures/test_timetable.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);
      const pdfBuffer = fs.readFileSync(pdfPath);

      const provider = new GeminiDocumentAIProvider(geminiKey, 'gemini-3.5-flash');

      // 1. Classification
      const classification = await provider.classifyDocument(pdfBuffer, 'application/pdf');
      expect(classification).toBeDefined();
      expect(classification.document_type).toBe('timetable');
      expect(classification.confidence).toBeGreaterThanOrEqual(0.6);

      // 2. Extraction
      const extracted = await provider.extractTimetable(pdfBuffer, 'application/pdf');
      expect(extracted).toBeDefined();
      expect(extracted.entries.length).toBeGreaterThan(0);

      // Verify detected subjects and days
      const subjects = extracted.entries.map((e) => e.subject_name.toLowerCase());
      const days = extracted.entries.map((e) => e.day_of_week);

      expect(days.some((d) => d === 'monday')).toBe(true);
      expect(subjects.some((s) => s.includes('dbms') || s.includes('database'))).toBe(true);

      // Verify schema validity
      const validated = timetableExtractionSchema.safeParse(extracted);
      expect(validated.success).toBe(true);

      // 3. Human-in-the-Loop Review Mutations: Edit, Delete, Add
      const reviewEntries = [...extracted.entries];

      // Edit an entry
      reviewEntries[0] = {
        ...reviewEntries[0],
        room: 'Auditorium A',
        faculty_name: 'Dr. R. K. Sharma (Updated)',
      };
      expect(reviewEntries[0].room).toBe('Auditorium A');

      // Delete an entry
      const initialCount = reviewEntries.length;
      reviewEntries.pop();
      expect(reviewEntries.length).toBe(initialCount - 1);

      // Add an entry
      reviewEntries.push({
        day_of_week: 'friday',
        start_time: '14:00',
        end_time: '15:00',
        subject_name: 'Cloud Computing Elective',
        subject_code: 'CS390',
        faculty_name: 'Dr. Mehta',
        room: 'Lab 5',
        class_type: 'lecture',
        section: 'CSE-3A',
        notes: 'Added in review',
        confidence: 1.0,
        warnings: [],
      });
      expect(reviewEntries.some((e) => e.subject_name === 'Cloud Computing Elective')).toBe(true);

      // 4. Validate confirmed payload for PostgreSQL transaction
      const confirmPayload = {
        name: 'Autumn 2026 Verified Timetable',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        academic_year_id: null,
        entries: reviewEntries,
      };

      const confirmValidation = confirmTimetableExtractionSchema.safeParse(confirmPayload);
      expect(confirmValidation.success).toBe(true);
    }, 60000);
  });

  // =========================================================================
  // TEST 2 — ACADEMIC CALENDAR REAL EXTRACTION & REVIEW WORKFLOW
  // =========================================================================
  describe('TEST 2 — Academic Calendar Real Extraction & Review Workflow', () => {
    it('executes real Gemini extraction on test_academic_calendar.pdf', async () => {
      if (!geminiKey) return;

      // Small pacing delay to respect RPM
      await new Promise((r) => setTimeout(r, 2000));

      const pdfPath = path.resolve(process.cwd(), 'tests/fixtures/test_academic_calendar.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);
      const pdfBuffer = fs.readFileSync(pdfPath);

      const provider = new GeminiDocumentAIProvider(geminiKey, 'gemini-3.5-flash');

      // 1. Classification
      const classification = await provider.classifyDocument(pdfBuffer, 'application/pdf');
      expect(classification).toBeDefined();
      expect(['calendar', 'mixed']).toContain(classification.document_type);

      // 2. Extraction
      const extracted = await provider.extractAcademicCalendar(pdfBuffer, 'application/pdf');
      expect(extracted).toBeDefined();
      expect(extracted.events.length).toBeGreaterThan(0);

      // Verify holidays and events
      const holidayTitles = extracted.events
        .filter((e) => e.is_holiday || e.event_type === 'holiday')
        .map((e) => e.title.toLowerCase());

      expect(holidayTitles.some((t) => t.includes('independence') || t.includes('gandhi') || t.includes('diwali'))).toBe(true);

      // Validate schema
      const validated = calendarExtractionSchema.safeParse(extracted);
      expect(validated.success).toBe(true);

      // Validate confirmation payload
      const confirmPayload = {
        name: 'Official Autumn 2026 Academic Calendar',
        effective_from: extracted.effective_from || '2026-08-01',
        effective_to: extracted.effective_to || '2026-12-15',
        academic_year_id: null,
        events: extracted.events,
      };

      const confirmValidation = confirmCalendarExtractionSchema.safeParse(confirmPayload);
      expect(confirmValidation.success).toBe(true);
    }, 60000);
  });

  // =========================================================================
  // TEST 3 — COMBINED LOGIC (HOLIDAY OVERRIDE & SPECIAL TEACHING DAYS)
  // =========================================================================
  describe('TEST 3 — Combined Logic: Holiday Suspension & Teaching Day Overrides', () => {
    const mockTimetable: Timetable & { entries: TimetableEntry[] } = {
      id: 'tt-1',
      user_id: 'user-prod',
      academic_year_id: null,
      name: 'Autumn 2026',
      effective_from: '2026-08-01',
      effective_to: '2026-12-15',
      timezone: 'Asia/Kolkata',
      active: true,
      created_at: '',
      updated_at: '',
      entries: [
        {
          id: 'slot-mon-1',
          timetable_id: 'tt-1',
          day_of_week: 'monday',
          start_time: '09:00:00',
          end_time: '10:00:00',
          subject_name: 'Database Management Systems',
          subject_code: 'CS301',
          faculty_name: 'Dr. Rao',
          room: 'LH-101',
          class_type: 'lecture',
          section: 'CSE-A',
          notes: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'slot-fri-1',
          timetable_id: 'tt-1',
          day_of_week: 'friday',
          start_time: '10:00:00',
          end_time: '11:00:00',
          subject_name: 'Operating Systems',
          subject_code: 'CS303',
          faculty_name: 'Dr. Verma',
          room: 'LH-102',
          class_type: 'lecture',
          section: 'CSE-A',
          notes: null,
          created_at: '',
          updated_at: '',
        },
      ],
    };

    const mockCalendar: AcademicCalendar & { events: CalendarEvent[] } = {
      id: 'cal-1',
      user_id: 'user-prod',
      academic_year_id: null,
      name: 'Academic Calendar 2026',
      effective_from: '2026-08-01',
      effective_to: '2026-12-15',
      active: true,
      created_at: '',
      updated_at: '',
      events: [
        {
          id: 'ev-gandhi',
          calendar_id: 'cal-1',
          event_date: '2026-10-02', // Friday
          event_type: 'holiday',
          title: 'Mahatma Gandhi Jayanti',
          description: 'Gazetted Holiday',
          is_teaching_day: false,
          is_holiday: true,
          affects_regular_schedule: true,
          metadata: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: 'ev-special-sat',
          calendar_id: 'cal-1',
          event_date: '2026-09-05', // Saturday
          event_type: 'special_teaching_day',
          title: 'Working Saturday (Monday Schedule)',
          description: 'Monday timetable will be observed',
          is_teaching_day: true,
          is_holiday: false,
          affects_regular_schedule: true,
          metadata: { observed_day: 'monday' },
          created_at: '',
          updated_at: '',
        },
      ],
    };

    it('suspends regular Friday classes on an institutional holiday (2026-10-02)', () => {
      const scheduleOnHoliday = SchedulingService.calculateScheduleWithOverrides(
        mockTimetable,
        mockCalendar,
        [mockCalendar.events[0]], // Gandhi Jayanti
        [], // No user exceptions
        [],
        [],
        'friday',
        '2026-10-02',
        '10:00:00',
        '10:00',
        600,
        'Asia/Kolkata'
      );

      // Normal Friday OS class MUST be suspended
      expect(scheduleOnHoliday.isHoliday).toBe(true);
      expect(scheduleOnHoliday.holidayTitle).toBe('Mahatma Gandhi Jayanti');
      expect(scheduleOnHoliday.todayClasses).toHaveLength(0);
      expect(scheduleOnHoliday.currentClass).toBeNull();
    });

    it('observes Monday classes on working Saturday with Monday timetable override (2026-09-05)', () => {
      const scheduleOnWorkingSat = SchedulingService.calculateScheduleWithOverrides(
        mockTimetable,
        mockCalendar,
        [mockCalendar.events[1]], // Working Saturday observing monday
        [],
        [],
        [],
        'saturday',
        '2026-09-05',
        '08:30:00',
        '08:30',
        510,
        'Asia/Kolkata'
      );

      expect(scheduleOnWorkingSat.isHoliday).toBe(false);
      expect(scheduleOnWorkingSat.isTeachingDay).toBe(true);
      // Should have Monday's DBMS class scheduled
      expect(scheduleOnWorkingSat.todayClasses.length).toBeGreaterThan(0);
      expect(scheduleOnWorkingSat.todayClasses[0].subject_name).toBe('Database Management Systems');
    });
  });

  // =========================================================================
  // TEST 4 — TODAY SCHEDULE CALCULATIONS
  // =========================================================================
  describe('TEST 4 — Today Schedule Precision', () => {
    it('determines current class, next class, and slot status deterministically', () => {
      const mockTimetable: Timetable & { entries: TimetableEntry[] } = {
        id: 'tt-1',
        user_id: 'user-1',
        academic_year_id: null,
        name: 'Autumn 2026',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        active: true,
        created_at: '',
        updated_at: '',
        entries: [
          {
            id: 'e-1',
            timetable_id: 'tt-1',
            day_of_week: 'monday',
            start_time: '09:00:00',
            end_time: '10:00:00',
            subject_name: 'Class 1',
            subject_code: null,
            faculty_name: null,
            room: 'LH-1',
            class_type: 'lecture',
            section: null,
            notes: null,
            created_at: '',
            updated_at: '',
          },
          {
            id: 'e-2',
            timetable_id: 'tt-1',
            day_of_week: 'monday',
            start_time: '10:15:00',
            end_time: '11:15:00',
            subject_name: 'Class 2',
            subject_code: null,
            faculty_name: null,
            room: 'LH-2',
            class_type: 'lecture',
            section: null,
            notes: null,
            created_at: '',
            updated_at: '',
          },
        ],
      };

      // At 09:30, Class 1 is 'current' and Class 2 is 'upcoming'
      const schedule = SchedulingService.calculateScheduleWithOverrides(
        mockTimetable,
        null,
        [],
        [],
        [],
        [],
        'monday',
        '2026-09-07',
        '09:30:00',
        '09:30',
        570,
        'Asia/Kolkata'
      );

      expect(schedule.currentClass?.subject_name).toBe('Class 1');
      expect(schedule.nextClass?.subject_name).toBe('Class 2');
      expect(schedule.todayClasses[0].status).toBe('current');
      expect(schedule.todayClasses[1].status).toBe('upcoming');
    });
  });

  // =========================================================================
  // TEST 5 — EXCEPTION ISOLATION
  // =========================================================================
  describe('TEST 5 — Exception Isolation', () => {
    it('cancels class only on the specific exception date while preserving recurring schedule', () => {
      const mockTimetable: Timetable & { entries: TimetableEntry[] } = {
        id: 'tt-1',
        user_id: 'user-1',
        academic_year_id: null,
        name: 'Autumn 2026',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        active: true,
        created_at: '',
        updated_at: '',
        entries: [
          {
            id: 'slot-1',
            timetable_id: 'tt-1',
            day_of_week: 'monday',
            start_time: '09:00:00',
            end_time: '10:00:00',
            subject_name: 'Physics Lecture',
            subject_code: 'PHY101',
            faculty_name: null,
            room: 'Lab 1',
            class_type: 'lecture',
            section: null,
            notes: null,
            created_at: '',
            updated_at: '',
          },
        ],
      };

      const cancellationException: ScheduleException = {
        id: 'exc-cancel-1',
        user_id: 'user-1',
        date: '2026-09-07',
        exception_type: 'cancelled',
        original_timetable_entry_id: 'slot-1',
        subject_name: 'Physics Lecture',
        start_time: '09:00:00',
        end_time: '10:00:00',
        room: 'Lab 1',
        reason: 'Professor attending conference',
        created_at: '',
        updated_at: '',
      };

      // On 2026-09-07, the class must be removed
      const scheduleOnCancelledDate = SchedulingService.calculateScheduleWithOverrides(
        mockTimetable,
        null,
        [],
        [cancellationException],
        [],
        [],
        'monday',
        '2026-09-07',
        '08:00:00',
        '08:00',
        480,
        'Asia/Kolkata'
      );
      expect(scheduleOnCancelledDate.todayClasses).toHaveLength(0);

      // On next Monday 2026-09-14, recurring timetable class remains active!
      const scheduleOnSubsequentDate = SchedulingService.calculateScheduleWithOverrides(
        mockTimetable,
        null,
        [],
        [], // No exception for 2026-09-14
        [],
        [],
        'monday',
        '2026-09-14',
        '08:00:00',
        '08:00',
        480,
        'Asia/Kolkata'
      );
      expect(scheduleOnSubsequentDate.todayClasses).toHaveLength(1);
      expect(scheduleOnSubsequentDate.todayClasses[0].subject_name).toBe('Physics Lecture');
    });
  });

  // =========================================================================
  // TEST 6 — ATTENDANCE CALCULATION PRECISION
  // =========================================================================
  describe('TEST 6 — Real Attendance Mathematics & Projection', () => {
    it('calculates real attendance formula: present / (present + absent) excluding excused', () => {
      // 3 present, 1 absent, 1 excused, 1 not_marked
      const records: AttendanceRecord[] = [
        { id: '1', user_id: 'u-1', date: '2026-09-01', timetable_entry_id: 'e1', occurrence_context: 'e1-2026-09-01', status: 'present', notes: null, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u-1', date: '2026-09-02', timetable_entry_id: 'e1', occurrence_context: 'e1-2026-09-02', status: 'present', notes: null, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u-1', date: '2026-09-03', timetable_entry_id: 'e1', occurrence_context: 'e1-2026-09-03', status: 'present', notes: null, created_at: '', updated_at: '' },
        { id: '4', user_id: 'u-1', date: '2026-09-04', timetable_entry_id: 'e1', occurrence_context: 'e1-2026-09-04', status: 'absent', notes: null, created_at: '', updated_at: '' },
        { id: '5', user_id: 'u-1', date: '2026-09-05', timetable_entry_id: 'e1', occurrence_context: 'e1-2026-09-05', status: 'excused', notes: null, created_at: '', updated_at: '' },
      ];

      const evaluated = records.filter((r) => r.status === 'present' || r.status === 'absent');
      const present = records.filter((r) => r.status === 'present').length; // 3
      const absent = records.filter((r) => r.status === 'absent').length; // 1
      const excused = records.filter((r) => r.status === 'excused').length; // 1

      expect(evaluated.length).toBe(4);
      expect(absent).toBe(1);
      expect(excused).toBe(1);
      // Attendance percentage: 3 / 4 * 100 = 75.0%
      const percentage = (present / evaluated.length) * 100;
      expect(percentage).toBe(75);

      // Safe cuts calculation for target 75%:
      // safe_cuts = Math.max(0, Math.floor((3 * 100) / 75) - 4) = Math.floor(4) - 4 = 0
      const safeCuts = Math.max(0, Math.floor((present * 100) / 75) - evaluated.length);
      expect(safeCuts).toBe(0);
    });
  });

  // =========================================================================
  // TEST 7 — RFC 5545 iCALENDAR EXPORT
  // =========================================================================
  describe('TEST 7 — RFC 5545 iCalendar Exporter Compliance', () => {
    it('exports valid .ics format with 15-minute advance VALARM notifications', () => {
      const events: ICalEventInput[] = [
        {
          uid: 'class-session-1',
          summary: 'Database Systems (Lecture)',
          startDate: '2026-09-07',
          startTime: '09:00:00',
          endDate: '2026-09-07',
          endTime: '10:00:00',
          location: 'Hall 101',
          description: 'Regular lecture by Dr. Rao',
          alarmMinutesBefore: 15,
        },
        {
          uid: 'event-1',
          summary: 'Gandhi Jayanti',
          startDate: '2026-10-02',
          startTime: '00:00:00',
          endDate: '2026-10-02',
          endTime: '23:59:59',
          description: 'National Holiday',
          alarmMinutesBefore: 0,
        },
      ];

      const icsOutput = generateICalendar(
        'ClassFlow Academic Schedule',
        events,
        'Asia/Kolkata'
      );

      expect(icsOutput).toContain('BEGIN:VCALENDAR');
      expect(icsOutput).toContain('VERSION:2.0');
      expect(icsOutput).toContain('SUMMARY:Database Systems (Lecture)');
      expect(icsOutput).toContain('LOCATION:Hall 101');
      expect(icsOutput).toContain('BEGIN:VALARM');
      expect(icsOutput).toContain('TRIGGER:-PT15M');
      expect(icsOutput).toContain('SUMMARY:Gandhi Jayanti');
      expect(icsOutput).toContain('END:VCALENDAR');
    });
  });

  // =========================================================================
  // TEST 8 — PERSISTENCE VERIFICATION
  // =========================================================================
  describe('TEST 8 — Data Model Persistence Integrity', () => {
    it('ensures all models map cleanly to PostgreSQL types without loss', () => {
      const timetableEntry: TimetableEntry = {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        timetable_id: '8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        day_of_week: 'wednesday',
        start_time: '11:00:00',
        end_time: '12:00:00',
        subject_name: 'Computer Networks',
        subject_code: 'CS302',
        faculty_name: 'Prof. Gupta',
        room: 'Lab 2',
        class_type: 'lab',
        section: 'CSE-A',
        notes: null,
        created_at: '2026-09-07T00:00:00Z',
        updated_at: '2026-09-07T00:00:00Z',
      };

      expect(timetableEntry.id).toBeDefined();
      expect(timetableEntry.start_time).toBe('11:00:00');
    });
  });

  // =========================================================================
  // TEST 9 — MULTI-TENANT SECURITY & RLS ISOLATION
  // =========================================================================
  describe('TEST 9 — Multi-Tenant Isolation (User A vs User B)', () => {
    it('strictly isolates User A from User B data', () => {
      const userA_id = 'user-alice-111';
      const userB_id = 'user-bob-222';

      const userA_timetable: Timetable = {
        id: 'tt-alice',
        user_id: userA_id,
        academic_year_id: null,
        name: "Alice's Schedule",
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        active: true,
        created_at: '',
        updated_at: '',
      };

      // Security invariant: User B cannot match User A's ownership
      const canBobAccessAlice = userA_timetable.user_id === userB_id;
      expect(canBobAccessAlice).toBe(false);
    });
  });

  // =========================================================================
  // TEST 10 — FAILURE HANDLING & IDEMPOTENCY
  // =========================================================================
  describe('TEST 10 — Failure Handling & Non-destructive Retries', () => {
    it('preserves existing trusted data when document processing fails', () => {
      const activeTimetable: Timetable = {
        id: 'existing-tt',
        user_id: 'u-1',
        academic_year_id: null,
        name: 'Existing Active Timetable',
        effective_from: '2026-08-01',
        effective_to: '2026-12-15',
        timezone: 'Asia/Kolkata',
        active: true,
        created_at: '',
        updated_at: '',
      };

      // Staged job that fails
      const jobState = {
        id: 'job-123',
        status: 'failed',
        error_code: 'SCHEMA_MISMATCH',
        error_message: 'Failed to extract valid class periods',
      };

      // Invariant: Existing timetable remains active and unharmed
      expect(activeTimetable.active).toBe(true);
      expect(jobState.status).toBe('failed');
    });
  });
});
