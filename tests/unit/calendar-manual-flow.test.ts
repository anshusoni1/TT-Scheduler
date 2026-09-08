import { describe, it, expect, vi } from 'vitest';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { SchedulingService } from '@/server/services/scheduling.service';
import { ForbiddenError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  AcademicCalendar,
  CalendarEvent,
  ScheduleException,
} from '@/types/database';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';

describe('Phase 5 Complete 15-Step Verification Flow', () => {
  const USER_A = '11111111-1111-1111-1111-111111111111';
  const USER_B = '22222222-2222-2222-2222-222222222222';

  // State mock store simulating real PostgreSQL database for User A and User B
  const dbCalendars: AcademicCalendar[] = [];
  const dbEvents: CalendarEvent[] = [];
  const dbExceptions: ScheduleException[] = [];

  const userATimetable: TimetableWithEntries = {
    id: 'tt-a',
    user_id: USER_A,
    academic_year_id: null,
    name: 'CS Fall 2026',
    effective_from: '2026-08-01',
    effective_to: '2026-12-31',
    timezone: 'Asia/Kolkata',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    entries: [
      {
        id: 'tt-entry-mon-dsa',
        timetable_id: 'tt-a',
        day_of_week: 'monday',
        start_time: '10:00:00',
        end_time: '11:00:00',
        subject_name: 'Data Structures',
        subject_code: 'CS201',
        faculty_name: 'Dr. Rao',
        room: 'Lab 1',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tt-entry-mon-os',
        timetable_id: 'tt-a',
        day_of_week: 'monday',
        start_time: '11:15:00',
        end_time: '12:15:00',
        subject_name: 'Operating Systems',
        subject_code: 'CS202',
        faculty_name: 'Dr. Sen',
        room: 'Room 302',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };

  function createMockSupabase(): SupabaseClient<Database> {
    return {
      from: vi.fn((table: string) => {
        if (table === 'academic_calendars') {
          return {
            insert: vi.fn((data: Partial<AcademicCalendar>) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  const newCal: AcademicCalendar = {
                    id: `cal-${dbCalendars.length + 1}`,
                    user_id: data.user_id!,
                    academic_year_id: data.academic_year_id ?? null,
                    name: data.name!,
                    effective_from: data.effective_from!,
                    effective_to: data.effective_to ?? null,
                    active: data.active ?? true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  dbCalendars.push(newCal);
                  return { data: newCal, error: null };
                }),
              }),
            })),
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field: string, val: string) => ({
                eq: vi.fn((field2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockImplementation(async () => {
                    const found = dbCalendars.find(
                      (c) => (c as Record<string, unknown>)[field] === val && (c as Record<string, unknown>)[field2] === val2
                    );
                    return { data: found || null, error: null };
                  }),
                })),
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const found = dbCalendars.find((c) => (c as Record<string, unknown>)[field] === val);
                  return { data: found || null, error: null };
                }),
              })),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }

        if (table === 'calendar_events') {
          return {
            insert: vi.fn((data: Partial<CalendarEvent>) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  const newEvent: CalendarEvent = {
                    id: `ev-${dbEvents.length + 1}`,
                    calendar_id: data.calendar_id!,
                    event_date: data.event_date!,
                    event_type: data.event_type!,
                    title: data.title!,
                    description: data.description ?? null,
                    is_teaching_day: data.is_teaching_day ?? false,
                    is_holiday: data.is_holiday ?? false,
                    affects_regular_schedule: data.affects_regular_schedule ?? true,
                    metadata: data.metadata ?? {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  dbEvents.push(newEvent);
                  return { data: newEvent, error: null };
                }),
              }),
            })),
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field1: string, val1: string) => ({
                order: vi.fn().mockImplementation(async () => {
                  const filtered = dbEvents.filter(
                    (e) => (e as Record<string, unknown>)[field1] === val1
                  );
                  return { data: filtered, error: null };
                }),
                eq: vi.fn((field2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockImplementation(async () => {
                    const found = dbEvents.find(
                      (e) => (e as Record<string, unknown>)[field1] === val1 && (e as Record<string, unknown>)[field2] === val2
                    );
                    return { data: found || null, error: null };
                  }),
                })),
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              })),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn((f1: string, v1: string) => ({
                eq: vi.fn((f2: string, v2: string) => {
                  const idx = dbEvents.findIndex(
                    (e) => (e as Record<string, unknown>)[f1] === v1 && (e as Record<string, unknown>)[f2] === v2
                  );
                  if (idx !== -1) {
                    dbEvents.splice(idx, 1);
                  }
                  return Promise.resolve({ error: null });
                }),
              })),
            }),
          };
        }

        if (table === 'schedule_exceptions') {
          return {
            insert: vi.fn((data: Partial<ScheduleException>) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(async () => {
                  const newEx: ScheduleException = {
                    id: `ex-${dbExceptions.length + 1}`,
                    user_id: data.user_id!,
                    date: data.date!,
                    exception_type: data.exception_type!,
                    original_timetable_entry_id: data.original_timetable_entry_id ?? null,
                    subject_name: data.subject_name ?? null,
                    start_time: data.start_time ?? null,
                    end_time: data.end_time ?? null,
                    room: data.room ?? null,
                    reason: data.reason ?? null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  dbExceptions.push(newEx);
                  return { data: newEx, error: null };
                }),
              }),
            })),
            select: vi.fn().mockReturnValue({
              eq: vi.fn((field: string, val: string) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  const found = dbExceptions.find((e) => (e as Record<string, unknown>)[field] === val);
                  return { data: found || null, error: null };
                }),
              })),
            }),
          };
        }

        return {};
      }) as unknown as SupabaseClient<Database>['from'],
    } as unknown as SupabaseClient<Database>;
  }

  it('verifies the full 15-step manual testing sequence', async () => {
    const supabase = createMockSupabase();
    const calendarsRepo = new CalendarsRepository(supabase);
    const exceptionsRepo = new ExceptionsRepository(supabase);

    // ==========================================
    // 1. Create academic calendar
    // ==========================================
    const createdCalendar = await calendarsRepo.createCalendar(USER_A, {
      name: 'Academic Year 2026-27',
      effective_from: '2026-08-01',
      effective_to: '2026-12-31',
      active: true,
    });
    expect(createdCalendar.id).toBe('cal-1');
    expect(createdCalendar.name).toBe('Academic Year 2026-27');
    expect(dbCalendars).toHaveLength(1);

    // ==========================================
    // 2. Add a holiday (e.g. 2026-09-14 Engineers' Day)
    // ==========================================
    const holidayEvent = await calendarsRepo.addEvent(USER_A, createdCalendar.id, {
      event_date: '2026-09-14',
      event_type: 'holiday',
      title: 'Engineers Day',
      description: 'College closed on Monday',
      is_holiday: true,
      is_teaching_day: false,
      affects_regular_schedule: true,
    });
    expect(holidayEvent.id).toBe('ev-1');
    expect(holidayEvent.title).toBe('Engineers Day');
    expect(dbEvents).toHaveLength(1);

    // ==========================================
    // 3. Refresh browser (or re-fetch from database)
    // ==========================================
    const fetchedEvent = await calendarsRepo.getEventById(USER_A, createdCalendar.id, holidayEvent.id);

    // ==========================================
    // 4. Confirm event persists
    // ==========================================
    expect(fetchedEvent).not.toBeNull();
    expect(fetchedEvent.title).toBe('Engineers Day');
    expect(fetchedEvent.is_holiday).toBe(true);

    // ==========================================
    // 5. Open the dashboard (Calculate schedule on 2026-09-14 at 10:30)
    // ==========================================
    const scheduleWithHoliday = SchedulingService.calculateScheduleWithOverrides(
      userATimetable,
      { ...createdCalendar, events: dbEvents },
      [fetchedEvent],
      [],
      [fetchedEvent],
      [],
      'monday',
      '2026-09-14',
      '10:30:00',
      '10:30',
      630,
      'Asia/Kolkata'
    );

    // ==========================================
    // 6. Confirm holiday status
    // ==========================================
    expect(scheduleWithHoliday.isHoliday).toBe(true);
    expect(scheduleWithHoliday.holidayTitle).toBe('Engineers Day');

    // ==========================================
    // 7. Confirm normal timetable classes are hidden for that date
    // ==========================================
    expect(scheduleWithHoliday.todayClasses).toHaveLength(0);
    expect(scheduleWithHoliday.currentClass).toBeNull();

    // ==========================================
    // 8. Remove the holiday
    // ==========================================
    await calendarsRepo.deleteEvent(USER_A, createdCalendar.id, holidayEvent.id);
    expect(dbEvents).toHaveLength(0);

    // ==========================================
    // 9. Confirm timetable returns
    // ==========================================
    const scheduleAfterHolidayRemoval = SchedulingService.calculateScheduleWithOverrides(
      userATimetable,
      { ...createdCalendar, events: dbEvents },
      [], // No events
      [],
      [],
      [],
      'monday',
      '2026-09-14',
      '10:30:00',
      '10:30',
      630,
      'Asia/Kolkata'
    );
    expect(scheduleAfterHolidayRemoval.isHoliday).toBe(false);
    expect(scheduleAfterHolidayRemoval.todayClasses).toHaveLength(2);
    expect(scheduleAfterHolidayRemoval.todayClasses[0].subject_name).toBe('Data Structures');
    expect(scheduleAfterHolidayRemoval.todayClasses[1].subject_name).toBe('Operating Systems');
    expect(scheduleAfterHolidayRemoval.currentClass?.subject_name).toBe('Data Structures');

    // ==========================================
    // 10. Add a teaching day
    // ==========================================
    const teachingDayEvent = await calendarsRepo.addEvent(USER_A, createdCalendar.id, {
      event_date: '2026-09-15',
      event_type: 'teaching_day',
      title: 'Full Instructional Day',
      is_teaching_day: true,
      is_holiday: false,
    });
    expect(teachingDayEvent.is_teaching_day).toBe(true);

    // ==========================================
    // 11. Add a working Saturday (following Monday timetable)
    // ==========================================
    const workingSaturdayEvent = await calendarsRepo.addEvent(USER_A, createdCalendar.id, {
      event_date: '2026-09-19',
      event_type: 'working_day',
      title: 'Working Saturday (Monday Order)',
      is_teaching_day: true,
      is_holiday: false,
      metadata: { follows_day: 'monday' },
    });
    const saturdaySchedule = SchedulingService.calculateScheduleWithOverrides(
      userATimetable,
      { ...createdCalendar, events: [workingSaturdayEvent] },
      [workingSaturdayEvent],
      [],
      [],
      [workingSaturdayEvent],
      'saturday',
      '2026-09-19',
      '10:30:00',
      '10:30',
      630,
      'Asia/Kolkata'
    );
    expect(saturdaySchedule.isTeachingDay).toBe(true);
    expect(saturdaySchedule.todayClasses).toHaveLength(2); // Monday's classes!
    expect(saturdaySchedule.todayClasses[0].subject_name).toBe('Data Structures');

    // ==========================================
    // 12. Create a one-day class cancellation
    // ==========================================
    const cancellationException = await exceptionsRepo.createException(USER_A, {
      date: '2026-09-14',
      exception_type: 'cancelled',
      original_timetable_entry_id: 'tt-entry-mon-os', // Cancels Operating Systems on 2026-09-14
      subject_name: 'Operating Systems',
      reason: 'Prof on leave',
    });
    expect(cancellationException.id).toBe('ex-1');

    // ==========================================
    // 13. Confirm only that date changes
    // ==========================================
    const dateWithCancellationSchedule = SchedulingService.calculateScheduleWithOverrides(
      userATimetable,
      { ...createdCalendar, events: [] },
      [],
      [cancellationException],
      [],
      [],
      'monday',
      '2026-09-14',
      '10:30:00',
      '10:30',
      630,
      'Asia/Kolkata'
    );
    expect(dateWithCancellationSchedule.todayClasses).toHaveLength(1);
    expect(dateWithCancellationSchedule.todayClasses[0].subject_name).toBe('Data Structures');
    expect(dateWithCancellationSchedule.todayClasses.find((c) => c.subject_name === 'Operating Systems')).toBeUndefined();

    // ==========================================
    // 14. Confirm recurring timetable remains unchanged
    // ==========================================
    expect(userATimetable.entries).toHaveLength(2);
    expect(userATimetable.entries.find((e) => e.subject_name === 'Operating Systems')).toBeDefined();

    // ==========================================
    // 15. Test another user cannot access the calendar
    // ==========================================
    // User B attempting to view User A's calendar must be blocked
    await expect(calendarsRepo.getCalendarById(USER_B, createdCalendar.id)).rejects.toThrow(ForbiddenError);

    // User B attempting to fetch User A's exception must be blocked
    await expect(exceptionsRepo.getExceptionById(USER_B, cancellationException.id)).rejects.toThrow(ForbiddenError);
  });
});
