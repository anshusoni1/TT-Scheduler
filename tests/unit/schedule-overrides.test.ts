import { describe, it, expect } from 'vitest';
import { SchedulingService } from '@/server/services/scheduling.service';
import type {
  CalendarEvent,
  ScheduleException,
} from '@/types/database';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';
import type { CalendarWithEvents } from '@/server/repositories/calendars.repository';

describe('Schedule Overrides & Deterministic 4-Tier Priority Cascade', () => {
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
        subject_name: 'Operating Systems',
        subject_code: 'CS302',
        faculty_name: 'Prof. Roy',
        room: 'Room 201',
        class_type: 'lecture',
        section: 'A',
        notes: null,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'entry-mon-3',
        timetable_id: 'tt-1',
        day_of_week: 'monday',
        start_time: '11:30:00',
        end_time: '12:30:00',
        subject_name: 'Linear Algebra',
        subject_code: 'MA201',
        faculty_name: 'Dr. Sen',
        room: 'Room 305',
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
    name: 'Calendar 2026',
    effective_from: '2026-08-01',
    effective_to: '2026-12-31',
    active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    events: [],
  };

  describe('Single-Day Schedule Overrides (Exceptions)', () => {
    it('cancels a single class for a specific date without modifying recurring timetable', () => {
      const cancelException: ScheduleException = {
        id: 'ex-cancel-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'cancelled',
        original_timetable_entry_id: 'entry-mon-2', // Cancels Operating Systems
        subject_name: 'Operating Systems',
        start_time: null,
        end_time: null,
        room: null,
        reason: 'Instructor on medical leave',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      // Calculate schedule for 2026-09-14
      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [],
        [cancelException],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      // On 2026-09-14, only 2 classes are active (Data Structures & Linear Algebra)
      expect(result.todayClasses).toHaveLength(2);
      expect(result.todayClasses.find((c) => c.subject_name === 'Operating Systems')).toBeUndefined();
      expect(result.todayClasses[0].subject_name).toBe('Data Structures');
      expect(result.todayClasses[1].subject_name).toBe('Linear Algebra');

      // CRITICAL CHECK: Base recurring timetable entries MUST remain untouched!
      expect(baseTimetable.entries).toHaveLength(3);
      expect(baseTimetable.entries.find((c) => c.subject_name === 'Operating Systems')).toBeDefined();

      // Another date (e.g. next Monday 2026-09-21) without exception has all 3 classes
      const nextWeekResult = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [],
        [], // No exception on 2026-09-21
        [],
        [],
        'monday',
        '2026-09-21',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );
      expect(nextWeekResult.todayClasses).toHaveLength(3);
      expect(nextWeekResult.todayClasses.find((c) => c.subject_name === 'Operating Systems')).toBeDefined();
    });

    it('modifies room for a single class session', () => {
      const roomException: ScheduleException = {
        id: 'ex-room-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'room_change',
        original_timetable_entry_id: 'entry-mon-1',
        subject_name: 'Data Structures',
        start_time: null,
        end_time: null,
        room: 'Seminar Hall 3',
        reason: 'Lab 2 maintenance',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [],
        [roomException],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      const dsaClass = result.todayClasses.find((c) => c.id === 'entry-mon-1');
      expect(dsaClass).toBeDefined();
      expect(dsaClass?.room).toBe('Seminar Hall 3');
      expect(dsaClass?.isOverride).toBe(true);
      expect(dsaClass?.notes).toContain('Room change: Seminar Hall 3');

      // Base recurring entry is still Lab 2
      expect(baseTimetable.entries[0].room).toBe('Lab 2');
    });

    it('reschedules time for a class and preserves chronological sorting', () => {
      const rescheduleException: ScheduleException = {
        id: 'ex-resched-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'rescheduled',
        original_timetable_entry_id: 'entry-mon-1', // Moved from 09:00 to 14:00
        subject_name: 'Data Structures',
        start_time: '14:00:00',
        end_time: '15:00:00',
        room: null,
        reason: 'Shifted to afternoon',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [],
        [rescheduleException],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      expect(result.todayClasses).toHaveLength(3);
      // First class should now be Operating Systems (10:15)
      expect(result.todayClasses[0].subject_name).toBe('Operating Systems');
      expect(result.todayClasses[1].subject_name).toBe('Linear Algebra');
      // Data Structures should now be third (14:00)
      expect(result.todayClasses[2].subject_name).toBe('Data Structures');
      expect(result.todayClasses[2].start_time).toBe('14:00:00');
      expect(result.todayClasses[2].isOverride).toBe(true);
    });

    it('adds an extra class for that specific date', () => {
      const extraClassException: ScheduleException = {
        id: 'ex-extra-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'extra_class',
        original_timetable_entry_id: null,
        subject_name: 'Remedial Physics',
        start_time: '15:30:00',
        end_time: '16:30:00',
        room: 'Room 401',
        reason: 'Midterm preparation extra lecture',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [],
        [extraClassException],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      expect(result.todayClasses).toHaveLength(4);
      const extra = result.todayClasses.find((c) => c.subject_name === 'Remedial Physics');
      expect(extra).toBeDefined();
      expect(extra?.room).toBe('Room 401');
      expect(extra?.start_time).toBe('15:30:00');
      expect(extra?.isOverride).toBe(true);
    });
  });

  describe('4-Tier Priority Cascade Rule Verification', () => {
    // 1. Explicit Exception > 2. Calendar Override > 3. Recurring Timetable > 4. Empty
    it('Priority 1 beats Priority 2: date_holiday exception suspends classes even if calendar marks teaching_day', () => {
      const calendarTeachingEvent: CalendarEvent = {
        id: 'ev-teach-1',
        calendar_id: 'cal-1',
        event_date: '2026-09-14',
        event_type: 'teaching_day',
        title: 'Regular Academic Day',
        description: null,
        is_teaching_day: true,
        is_holiday: false,
        affects_regular_schedule: false,
        metadata: {},
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      };

      const exceptionHoliday: ScheduleException = {
        id: 'ex-hol-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'date_holiday',
        original_timetable_entry_id: null,
        subject_name: null,
        start_time: null,
        end_time: null,
        room: null,
        reason: 'Unplanned local holiday',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [calendarTeachingEvent],
        [exceptionHoliday],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      // Exception takes precedence!
      expect(result.isHoliday).toBe(true);
      expect(result.isTeachingDay).toBe(false);
      expect(result.todayClasses).toHaveLength(0);
    });

    it('Priority 1 beats Priority 2: date_teaching_day exception conducts classes even if calendar marks holiday', () => {
      const calendarHolidayEvent: CalendarEvent = {
        id: 'ev-hol-1',
        calendar_id: 'cal-1',
        event_date: '2026-09-14',
        event_type: 'holiday',
        title: 'Regional Holiday',
        description: null,
        is_teaching_day: false,
        is_holiday: true,
        affects_regular_schedule: true,
        metadata: {},
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      };

      const exceptionTeaching: ScheduleException = {
        id: 'ex-teach-1',
        user_id: USER_ID,
        date: '2026-09-14',
        exception_type: 'date_teaching_day',
        original_timetable_entry_id: null,
        subject_name: null,
        start_time: null,
        end_time: null,
        room: null,
        reason: 'Mandatory special makeup class session',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-10T00:00:00Z',
      };

      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [calendarHolidayEvent],
        [exceptionTeaching],
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      // Exception takes precedence! Classes are held!
      expect(result.isHoliday).toBe(false);
      expect(result.isTeachingDay).toBe(true);
      expect(result.todayClasses).toHaveLength(3);
    });

    it('Priority 2 beats Priority 3: Calendar holiday suppresses recurring timetable', () => {
      const calendarHolidayEvent: CalendarEvent = {
        id: 'ev-hol-2',
        calendar_id: 'cal-1',
        event_date: '2026-09-14',
        event_type: 'holiday',
        title: 'Mid-Semester Break',
        description: null,
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
        [calendarHolidayEvent],
        [], // No exceptions
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      // Calendar suppresses timetable
      expect(result.isHoliday).toBe(true);
      expect(result.todayClasses).toHaveLength(0);
    });

    it('Priority 3 beats Priority 4: Recurring timetable applies when no exception or calendar event exists', () => {
      const result = SchedulingService.calculateScheduleWithOverrides(
        baseTimetable,
        baseCalendar,
        [], // No events today
        [], // No exceptions today
        [],
        [],
        'monday',
        '2026-09-14',
        '09:00:00',
        '09:00',
        540,
        'Asia/Kolkata'
      );

      // Timetable runs normally
      expect(result.isHoliday).toBe(false);
      expect(result.isTeachingDay).toBe(true);
      expect(result.todayClasses).toHaveLength(3);
    });
  });
});
