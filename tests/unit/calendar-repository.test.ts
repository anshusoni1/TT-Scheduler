import { describe, it, expect, vi } from 'vitest';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { ForbiddenError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CalendarEvent, AcademicCalendar, ScheduleException } from '@/types/database';

describe('CalendarsRepository & ExceptionsRepository CRUD & Authorization', () => {
  const USER_A = '11111111-1111-1111-1111-111111111111';
  const USER_B = '22222222-2222-2222-2222-222222222222';
  const CALENDAR_ID = '33333333-3333-3333-3333-333333333333';
  const EVENT_ID = '44444444-4444-4444-4444-444444444444';
  const EXCEPTION_ID = '55555555-5555-5555-5555-555555555555';

  describe('CalendarsRepository', () => {
    it('creates an academic calendar and persists events in Supabase', async () => {
      const mockCalendar: AcademicCalendar = {
        id: CALENDAR_ID,
        user_id: USER_A,
        academic_year_id: null,
        name: 'Fall 2026 Academic Calendar',
        effective_from: '2026-08-01',
        effective_to: '2026-12-31',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: CalendarEvent = {
        id: EVENT_ID,
        calendar_id: CALENDAR_ID,
        event_date: '2026-09-15',
        event_type: 'holiday',
        title: 'Engineers Day',
        description: 'Institute closed',
        is_teaching_day: false,
        is_holiday: true,
        affects_regular_schedule: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'academic_calendars') {
            return {
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockCalendar, error: null }),
                }),
              }),
            };
          }
          if (table === 'calendar_events') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [mockEvent], error: null }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new CalendarsRepository(mockSupabase);
      const result = await repo.createCalendar(
        USER_A,
        {
          name: 'Fall 2026 Academic Calendar',
          effective_from: '2026-08-01',
          effective_to: '2026-12-31',
          active: true,
        },
        [
          {
            event_date: '2026-09-15',
            event_type: 'holiday',
            title: 'Engineers Day',
            is_holiday: true,
            is_teaching_day: false,
          },
        ]
      );

      expect(result.id).toBe(CALENDAR_ID);
      expect(result.name).toBe('Fall 2026 Academic Calendar');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Engineers Day');
      expect(result.events[0].is_holiday).toBe(true);
    });

    it('enforces ownership check on getCalendarById (throws ForbiddenError for cross-user access)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: CALENDAR_ID,
                  user_id: USER_A, // Owned by User A
                  name: "User A's Calendar",
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new CalendarsRepository(mockSupabase);

      // User B attempts to access User A's calendar
      await expect(repo.getCalendarById(USER_B, CALENDAR_ID)).rejects.toThrow(ForbiddenError);
    });

    it('adds and deletes calendar events safely verifying calendar ownership', async () => {
      const mockCalendar: AcademicCalendar = {
        id: CALENDAR_ID,
        user_id: USER_A,
        academic_year_id: null,
        name: 'Spring 2026 Calendar',
        effective_from: '2026-01-01',
        effective_to: '2026-06-30',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockEvent: CalendarEvent = {
        id: EVENT_ID,
        calendar_id: CALENDAR_ID,
        event_date: '2026-03-25',
        event_type: 'exam',
        title: 'Midterm Examination',
        description: 'Computer Architecture exam',
        is_teaching_day: true,
        is_holiday: false,
        affects_regular_schedule: true,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'academic_calendars') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockCalendar, error: null }),
                }),
              }),
            };
          }
          if (table === 'calendar_events') {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
                }),
              }),
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [mockEvent], error: null }),
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockEvent, error: null }),
                  }),
                }),
              }),
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new CalendarsRepository(mockSupabase);

      const added = await repo.addEvent(USER_A, CALENDAR_ID, {
        event_date: '2026-03-25',
        event_type: 'exam',
        title: 'Midterm Examination',
        is_teaching_day: true,
        is_holiday: false,
      });

      expect(added.id).toBe(EVENT_ID);
      expect(added.title).toBe('Midterm Examination');

      // Delete event
      await expect(repo.deleteEvent(USER_A, CALENDAR_ID, EVENT_ID)).resolves.not.toThrow();
    });
  });

  describe('ExceptionsRepository', () => {
    it('creates, retrieves, and validates schedule exceptions with user ownership', async () => {
      const mockException: ScheduleException = {
        id: EXCEPTION_ID,
        user_id: USER_A,
        date: '2026-09-14',
        exception_type: 'cancelled',
        original_timetable_entry_id: 'entry-123',
        subject_name: 'Database Systems',
        start_time: '10:00:00',
        end_time: '11:00:00',
        room: 'Lab 3',
        reason: 'Instructor attending conference',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockException, error: null }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockException, error: null }),
              order: vi.fn().mockResolvedValue({ data: [mockException], error: null }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new ExceptionsRepository(mockSupabase);

      const created = await repo.createException(USER_A, {
        date: '2026-09-14',
        exception_type: 'cancelled',
        original_timetable_entry_id: 'entry-123',
        subject_name: 'Database Systems',
        reason: 'Instructor attending conference',
      });

      expect(created.id).toBe(EXCEPTION_ID);
      expect(created.exception_type).toBe('cancelled');

      // Check cross-user rejection
      await expect(repo.getExceptionById(USER_B, EXCEPTION_ID)).rejects.toThrow(ForbiddenError);

      // Verify legitimate access
      const fetched = await repo.getExceptionById(USER_A, EXCEPTION_ID);
      expect(fetched.id).toBe(EXCEPTION_ID);
    });
  });
});
