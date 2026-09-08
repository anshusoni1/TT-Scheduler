import { describe, it, expect, vi } from 'vitest';
import { SchedulingService } from '@/server/services/scheduling.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CalendarEvent,
  ScheduleException,
  AcademicCalendar,
  Database,
} from '@/types/database';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';
import type { CalendarWithEvents } from '@/server/repositories/calendars.repository';

describe('SchedulingService - Deterministic Academic Calendar & Overrides', () => {
  const USER_ID = '11111111-1111-1111-1111-111111111111';

  const baseTimetable: TimetableWithEntries = {
    id: 'tt-1',
    user_id: USER_ID,
    academic_year_id: null,
    name: 'CS Semester 5',
    effective_from: '2026-08-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kolkata',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    entries: [
      {
        id: 'entry-mon-1',
        timetable_id: 'tt-1',
        day_of_week: 'monday',
        start_time: '09:00:00',
        end_time: '10:00:00',
        subject_name: 'Data Structures',
        subject_code: 'CS301',
        faculty_name: 'Dr. Sharma',
        room: 'Lab 2',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'entry-mon-2',
        timetable_id: 'tt-1',
        day_of_week: 'monday',
        start_time: '10:15:00',
        end_time: '11:15:00',
        subject_name: 'Algorithms',
        subject_code: 'CS302',
        faculty_name: 'Prof. Rao',
        room: 'Room 101',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'entry-tue-1',
        timetable_id: 'tt-1',
        day_of_week: 'tuesday',
        start_time: '09:00:00',
        end_time: '10:00:00',
        subject_name: 'Computer Networks',
        subject_code: 'CS303',
        faculty_name: 'Dr. Verma',
        room: 'Room 204',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ],
  };

  const baseCalendar: CalendarWithEvents = {
    id: 'cal-1',
    user_id: USER_ID,
    academic_year_id: null,
    name: 'Academic Calendar 2026-27',
    effective_from: '2026-08-01',
    effective_to: '2026-12-31',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    events: [],
  };

  function createTeachingDaySupabaseMock(options: {
    exceptions?: Partial<ScheduleException>[];
    calendar?: AcademicCalendar | null;
    calendarEvents?: Partial<CalendarEvent>[];
    timetable?: TimetableWithEntries | null;
  }): SupabaseClient<Database> {
    return {
      from: vi.fn((table: string) => {
        if (table === 'schedule_exceptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: options.exceptions || [],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'academic_calendars') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: options.calendar ?? null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'calendar_events') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: options.calendarEvents || [],
                  error: null,
                }),
                eq: vi.fn().mockResolvedValue({
                  data: options.calendarEvents || [],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'timetables') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: options.timetable ? { id: options.timetable.id, user_id: options.timetable.user_id, active: true } : null,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'timetable_entries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: options.timetable ? options.timetable.entries : [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;
  }

  describe('isTeachingDay deterministic evaluation', () => {
    it('returns false if an explicit schedule exception marks date_holiday (Tier 1)', async () => {
      const mockSupabase = createTeachingDaySupabaseMock({
        exceptions: [
          {
            id: 'ex-1',
            user_id: USER_ID,
            date: '2026-09-14',
            exception_type: 'date_holiday',
            reason: 'Local emergency holiday',
          },
        ],
        timetable: baseTimetable,
      });

      const isTeaching = await SchedulingService.isTeachingDay(
        mockSupabase,
        USER_ID,
        '2026-09-14' // Monday
      );

      expect(isTeaching).toBe(false);
    });

    it('returns true if an explicit schedule exception marks date_teaching_day even if calendar is holiday', async () => {
      const mockSupabase = createTeachingDaySupabaseMock({
        exceptions: [
          {
            id: 'ex-2',
            user_id: USER_ID,
            date: '2026-09-14',
            exception_type: 'date_teaching_day',
            reason: 'Compensatory working day',
          },
        ],
        calendar: baseCalendar,
        calendarEvents: [
          {
            id: 'ev-1',
            calendar_id: 'cal-1',
            event_date: '2026-09-14',
            event_type: 'holiday',
            title: 'Festival',
            is_holiday: true,
          },
        ],
        timetable: baseTimetable,
      });

      const isTeaching = await SchedulingService.isTeachingDay(
        mockSupabase,
        USER_ID,
        '2026-09-14'
      );

      expect(isTeaching).toBe(true);
    });

    it('returns false when calendar marks a date as holiday or recess (Tier 2)', async () => {
      const mockSupabase = createTeachingDaySupabaseMock({
        calendar: baseCalendar,
        calendarEvents: [
          {
            id: 'ev-2',
            calendar_id: 'cal-1',
            event_date: '2026-09-14',
            event_type: 'holiday',
            title: 'National Holiday',
            is_holiday: true,
          },
        ],
        timetable: baseTimetable,
      });

      const isTeaching = await SchedulingService.isTeachingDay(
        mockSupabase,
        USER_ID,
        '2026-09-14'
      );

      expect(isTeaching).toBe(false);
    });

    it('falls back to timetable behavior when no calendar event exists (Tier 3)', async () => {
      const mockSupabase = createTeachingDaySupabaseMock({
        timetable: baseTimetable,
      });

      // 2026-09-14 is a Monday (has CS301 & CS302) -> true
      const isMondayTeaching = await SchedulingService.isTeachingDay(
        mockSupabase,
        USER_ID,
        '2026-09-14'
      );
      expect(isMondayTeaching).toBe(true);

      // 2026-09-13 is Sunday (no classes) -> false
      const isSundayTeaching = await SchedulingService.isTeachingDay(
        mockSupabase,
        USER_ID,
        '2026-09-13'
      );
      expect(isSundayTeaching).toBe(false);
    });
  });

  describe('calculateScheduleWithOverrides', () => {
    it('suppresses regular timetable classes on calendar holidays and sets isHoliday: true', () => {
      const holidayEvent: CalendarEvent = {
        id: 'h-1',
        calendar_id: 'cal-1',
        event_date: '2026-09-14',
        event_type: 'holiday',
        title: 'Independence Day Observance',
        description: 'College closed',
        is_teaching_day: false,
        is_holiday: true,
        affects_regular_schedule: true,
        metadata: {},
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [holidayEvent],
        [], // No exceptions
        [holidayEvent],
        [],
        'monday',
        '2026-09-14',
        '09:30:00',
        '09:30',
        570,
        'Asia/Kolkata'
      );

      expect(result.isHoliday).toBe(true);
      expect(result.isTeachingDay).toBe(false);
      expect(result.holidayTitle).toBe('Independence Day Observance');
      expect(result.todayClasses).toHaveLength(0); // Normal classes suppressed!
      expect(result.currentClass).toBeNull();
      // Next class should search forward to Tuesday
      expect(result.nextClass).not.toBeNull();
      expect(result.nextClass?.subject_name).toBe('Computer Networks');
      expect(result.nextClass?.targetDay).toBe('tuesday');
    });

    it('supports Working Saturday with follows_day: monday to execute Monday classes on Saturday', () => {
      const workingSaturdayEvent: CalendarEvent = {
        id: 'ws-1',
        calendar_id: 'cal-1',
        event_date: '2026-09-19',
        event_type: 'working_day',
        title: 'Working Saturday (Monday Schedule)',
        description: 'Compensatory class day',
        is_teaching_day: true,
        is_holiday: false,
        affects_regular_schedule: true,
        metadata: { follows_day: 'monday' },
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      };

      // Saturday 2026-09-19 at 09:30
      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [workingSaturdayEvent],
        [],
        [],
        [workingSaturdayEvent],
        'saturday',
        '2026-09-19',
        '09:30:00',
        '09:30',
        570,
        'Asia/Kolkata'
      );

      expect(result.isTeachingDay).toBe(true);
      expect(result.isHoliday).toBe(false);
      expect(result.todayClasses).toHaveLength(2); // Monday's 2 classes are run!
      expect(result.todayClasses[0].subject_name).toBe('Data Structures');
      expect(result.todayClasses[1].subject_name).toBe('Algorithms');
      expect(result.currentClass?.subject_name).toBe('Data Structures');
      expect(result.scheduleNote).toContain('Operating on monday schedule');
    });

    it('operates safely for calendar-only users (no timetable)', () => {
      const academicEvent: CalendarEvent = {
        id: 'event-1',
        calendar_id: 'cal-1',
        event_date: '2026-09-14',
        event_type: 'special_event',
        title: 'Orientation & Induction',
        description: 'Auditorium hall at 10 AM',
        is_teaching_day: true,
        is_holiday: false,
        affects_regular_schedule: false,
        metadata: {},
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        null, // No timetable!
        baseCalendar,
        [academicEvent],
        [],
        [],
        [academicEvent],
        'monday',
        '2026-09-14',
        '10:00:00',
        '10:00',
        600,
        'Asia/Kolkata'
      );

      expect(result.hasTimetable).toBe(false);
      expect(result.hasCalendar).toBe(true);
      expect(result.isTeachingDay).toBe(true);
      expect(result.todayClasses).toHaveLength(0);
      expect(result.currentClass).toBeNull();
      expect(result.nextClass).toBeNull();
      expect(result.todayEvents).toHaveLength(1);
      expect(result.todayEvents[0].title).toBe('Orientation & Induction');
    });

    it('operates safely for timetable-only users (no calendar)', () => {
      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        null, // No calendar!
        [],
        [],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:30:00',
        '09:30',
        570,
        'Asia/Kolkata'
      );

      expect(result.hasTimetable).toBe(true);
      expect(result.hasCalendar).toBe(false);
      expect(result.isTeachingDay).toBe(true);
      expect(result.isHoliday).toBe(false);
      expect(result.todayClasses).toHaveLength(2);
      expect(result.currentClass?.subject_name).toBe('Data Structures');
    });

    it('operates safely when user has neither timetable nor calendar', () => {
      const result = SchedulingService.calculateScheduleWithOverrides(
        null,
        null,
        [],
        [],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:30:00',
        '09:30',
        570,
        'Asia/Kolkata'
      );

      expect(result.hasTimetable).toBe(false);
      expect(result.hasCalendar).toBe(false);
      expect(result.isTeachingDay).toBe(false);
      expect(result.isHoliday).toBe(false);
      expect(result.todayClasses).toHaveLength(0);
      expect(result.currentClass).toBeNull();
      expect(result.nextClass).toBeNull();
    });
  });
});
