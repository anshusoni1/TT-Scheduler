import { describe, it, expect, vi } from 'vitest';
import { SchedulingService } from '@/server/services/scheduling.service';
import { getDatesBetween } from '@/lib/dates';
import type { TypedSupabaseClient, CalendarEvent, ScheduleException, AcademicCalendar } from '@/types/database';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';

describe('Schedule Synthesis & Attendance Analytics (Phase 7)', () => {
  const USER_ID = 'test-user-phase7-1111-1111';

  describe('getDatesBetween', () => {
    it('returns a single date when start and end are identical', () => {
      const dates = getDatesBetween('2026-09-15', '2026-09-15');
      expect(dates).toEqual(['2026-09-15']);
    });

    it('returns all intermediate dates chronologically inclusive across month boundaries', () => {
      const dates = getDatesBetween('2026-09-29', '2026-10-02');
      expect(dates).toEqual([
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
      ]);
    });

    it('returns empty array when startDate is chronologically after endDate', () => {
      const dates = getDatesBetween('2026-10-05', '2026-10-01');
      expect(dates).toEqual([]);
    });
  });

  describe('synthesizeScheduleForRange and calculateAttendanceAnalytics', () => {
    const mockTimetable: TimetableWithEntries = {
      id: 'tt-phase7',
      user_id: USER_ID,
      academic_year_id: null,
      name: 'B.Tech Semester 5',
      effective_from: '2026-09-01',
      effective_to: '2026-09-30',
      timezone: 'Asia/Kolkata',
      active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      entries: [
        {
          id: 'tt-entry-mon-1',
          timetable_id: 'tt-phase7',
          day_of_week: 'monday',
          start_time: '09:00:00',
          end_time: '10:00:00',
          subject_name: 'Database Systems',
          subject_code: 'CS301',
          faculty_name: 'Dr. Codd',
          room: 'Room 101',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'tt-entry-mon-2',
          timetable_id: 'tt-phase7',
          day_of_week: 'monday',
          start_time: '10:15:00',
          end_time: '11:15:00',
          subject_name: 'Computer Networks',
          subject_code: 'CS302',
          faculty_name: 'Prof. Cerf',
          room: 'Room 102',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'tt-entry-tue-1',
          timetable_id: 'tt-phase7',
          day_of_week: 'tuesday',
          start_time: '09:00:00',
          end_time: '10:00:00',
          subject_name: 'Database Systems',
          subject_code: 'CS301',
          faculty_name: 'Dr. Codd',
          room: 'Room 101',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ],
    };

    const mockCalendar: AcademicCalendar = {
      id: 'cal-phase7',
      user_id: USER_ID,
      academic_year_id: null,
      name: 'Autumn 2026 Calendar',
      effective_from: '2026-09-01',
      effective_to: '2026-09-14',
      active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };

    // Events: 2026-09-07 is Monday (Holiday: Janmashtami), 2026-09-12 is Saturday (Teaching day, following Monday schedule)
    const mockEvents: CalendarEvent[] = [
      {
        id: 'ev-holiday-1',
        calendar_id: 'cal-phase7',
        event_date: '2026-09-07', // Monday
        title: 'Janmashtami Holiday',
        event_type: 'holiday',
        is_teaching_day: false,
        is_holiday: true,
        affects_regular_schedule: true,
        metadata: {},
        description: 'University closed',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'ev-working-sat',
        calendar_id: 'cal-phase7',
        event_date: '2026-09-12', // Saturday
        title: 'Working Saturday (Monday Schedule)',
        event_type: 'special_teaching_day',
        is_teaching_day: true,
        is_holiday: false,
        affects_regular_schedule: true,
        metadata: { follows_day: 'monday' },
        description: 'Compensatory instructional day',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ];

    function createSynthesisMockSupabase(options: {
      timetable?: TimetableWithEntries | null;
      calendar?: AcademicCalendar | null;
      events?: CalendarEvent[];
      exceptions?: ScheduleException[];
    }): TypedSupabaseClient {
      return {
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: USER_ID, timezone: 'Asia/Kolkata', name: 'Test Student' },
                    error: null,
                  }),
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: USER_ID, timezone: 'Asia/Kolkata', name: 'Test Student' },
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
                          data: options.timetable ?? null,
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
                    data: options.events || [],
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'schedule_exceptions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: options.exceptions || [],
                    error: null,
                  }),
                }),
              }),
            };
          }

          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      } as unknown as TypedSupabaseClient;
    }

    it('synthesizes schedule correctly suspending classes on holidays and substituting on working Saturdays', async () => {
      const mockSupabase = createSynthesisMockSupabase({
        timetable: mockTimetable,
        calendar: mockCalendar,
        events: mockEvents,
        exceptions: [],
      });

      // Query one week: 2026-09-07 (Mon) to 2026-09-13 (Sun)
      const range = await SchedulingService.synthesizeScheduleForRange(
        mockSupabase,
        USER_ID,
        '2026-09-07',
        '2026-09-13'
      );

      expect(range.length).toBe(7);

      // Day 1: Monday 2026-09-07 is an official holiday -> classes suspended
      const monday = range.find((d) => d.dateString === '2026-09-07');
      expect(monday).toBeDefined();
      expect(monday?.isHoliday).toBe(true);
      expect(monday?.holidayTitle).toBe('Janmashtami Holiday');
      expect(monday?.classes).toHaveLength(0);

      // Day 2: Tuesday 2026-09-08 is regular teaching day
      const tuesday = range.find((d) => d.dateString === '2026-09-08');
      expect(tuesday).toBeDefined();
      expect(tuesday?.isHoliday).toBe(false);
      expect(tuesday?.isTeachingDay).toBe(true);
      expect(tuesday?.classes).toHaveLength(1);
      expect(tuesday?.classes[0].subject_name).toBe('Database Systems');

      // Day 6: Saturday 2026-09-12 is working Saturday substituting Monday schedule
      const saturday = range.find((d) => d.dateString === '2026-09-12');
      expect(saturday).toBeDefined();
      expect(saturday?.isHoliday).toBe(false);
      expect(saturday?.isTeachingDay).toBe(true);
      expect(saturday?.classes).toHaveLength(2); // Monday had 2 classes!
      expect(saturday?.classes[0].subject_name).toBe('Database Systems');
      expect(saturday?.classes[1].subject_name).toBe('Computer Networks');
      expect(saturday?.classes[0].isOverride).toBe(true);
    });

    it('calculates semester attendance metrics, total classes, and exact safe cuts margin', async () => {
      const mockSupabase = createSynthesisMockSupabase({
        timetable: mockTimetable,
        calendar: mockCalendar,
        events: mockEvents,
        exceptions: [],
      });

      // Target = 75%
      const analytics = await SchedulingService.calculateAttendanceAnalytics(
        mockSupabase,
        USER_ID,
        75
      );

      expect(analytics.target_percentage).toBe(75);
      expect(analytics.semester_range.start_date).toBe('2026-09-01');
      expect(analytics.semester_range.end_date).toBe('2026-09-14');
      expect(analytics.total_holidays).toBeGreaterThanOrEqual(1);

      // Verify subject breakdown exists
      const dbSubject = analytics.subjects.find((s) => s.subject_name === 'Database Systems');
      expect(dbSubject).toBeDefined();

      if (dbSubject) {
        expect(dbSubject.total_scheduled).toBeGreaterThan(0);
        // Formula checks
        const expectedSafeCuts = Math.max(0, Math.floor(dbSubject.total_scheduled * (1 - 0.75)));
        const expectedMinNeeded = Math.ceil(dbSubject.total_scheduled * 0.75);

        expect(dbSubject.safe_cuts_allowance).toBe(expectedSafeCuts);
        expect(dbSubject.minimum_classes_needed).toBe(expectedMinNeeded);
        expect(dbSubject.classes_held_to_date + dbSubject.remaining_classes).toBe(dbSubject.total_scheduled);
      }
    });

    it('returns empty subject list and zero scheduled classes when no active timetable exists', async () => {
      const mockSupabase = createSynthesisMockSupabase({
        timetable: null,
        calendar: mockCalendar,
        events: [],
      });

      const analytics = await SchedulingService.calculateAttendanceAnalytics(
        mockSupabase,
        USER_ID,
        75
      );

      expect(analytics.total_classes_semester).toBe(0);
      expect(analytics.classes_held_to_date).toBe(0);
      expect(analytics.subjects).toHaveLength(0);
    });

    it('adapts safe cuts threshold correctly for custom 85% attendance requirement', async () => {
      const mockSupabase = createSynthesisMockSupabase({
        timetable: mockTimetable,
        calendar: mockCalendar,
        events: mockEvents,
      });

      const analytics85 = await SchedulingService.calculateAttendanceAnalytics(
        mockSupabase,
        USER_ID,
        85
      );

      expect(analytics85.target_percentage).toBe(85);
      const dbSub85 = analytics85.subjects.find((s) => s.subject_name === 'Database Systems');
      expect(dbSub85).toBeDefined();

      if (dbSub85) {
        const expectedSafeCuts85 = Math.max(0, Math.floor(dbSub85.total_scheduled * (1 - 0.85)));
        expect(dbSub85.safe_cuts_allowance).toBe(expectedSafeCuts85);
      }
    });
  });
});
