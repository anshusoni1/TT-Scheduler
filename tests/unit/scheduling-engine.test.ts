import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  doTimesOverlap,
  getNextDaysOfWeek,
} from '@/lib/dates';
import {
  SchedulingService,
} from '@/server/services/scheduling.service';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';
import type { TimetableEntry } from '@/types/database';

describe('Date & Scheduling Utilities', () => {
  describe('timeToMinutes', () => {
    it('converts standard HH:MM strings to minutes from midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('01:30')).toBe(90);
      expect(timeToMinutes('09:45')).toBe(585);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('handles seconds in HH:MM:SS format safely', () => {
      expect(timeToMinutes('10:15:30')).toBe(615);
      expect(timeToMinutes('14:30:00')).toBe(870);
    });
  });

  describe('doTimesOverlap', () => {
    it('identifies non-overlapping consecutive time windows (touching boundaries do not overlap)', () => {
      // Slot 1: 10:00 - 11:00, Slot 2: 11:00 - 12:00
      expect(doTimesOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false);
      expect(doTimesOverlap('11:00', '12:00', '10:00', '11:00')).toBe(false);
    });

    it('identifies completely separate time windows', () => {
      expect(doTimesOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false);
    });

    it('identifies partial overlaps', () => {
      // 10:00 - 11:30 and 11:00 - 12:00 overlap between 11:00 and 11:30
      expect(doTimesOverlap('10:00', '11:30', '11:00', '12:00')).toBe(true);
      expect(doTimesOverlap('11:00', '12:00', '10:00', '11:30')).toBe(true);
    });

    it('identifies fully enclosed time windows', () => {
      // 10:00 - 13:00 encloses 11:00 - 12:00
      expect(doTimesOverlap('10:00', '13:00', '11:00', '12:00')).toBe(true);
      expect(doTimesOverlap('11:00', '12:00', '10:00', '13:00')).toBe(true);
    });

    it('identifies identical time windows', () => {
      expect(doTimesOverlap('10:00', '11:00', '10:00', '11:00')).toBe(true);
    });
  });

  describe('getNextDaysOfWeek', () => {
    it('generates cyclic list of subsequent 6 days in chronological order', () => {
      expect(getNextDaysOfWeek('monday')).toEqual([
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]);

      expect(getNextDaysOfWeek('friday')).toEqual([
        'saturday',
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
      ]);

      expect(getNextDaysOfWeek('sunday')).toEqual([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ]);
    });
  });
});

describe('SchedulingService (Deterministic Engine)', () => {
  const createMockEntry = (
    id: string,
    day: TimetableEntry['day_of_week'],
    start: string,
    end: string,
    subject: string
  ): TimetableEntry => ({
    id,
    timetable_id: 'tt-100',
    day_of_week: day,
    start_time: start,
    end_time: end,
    subject_name: subject,
    subject_code: 'CS101',
    faculty_name: 'Dr. Turing',
    room: 'Lab 4',
    class_type: 'lecture',
    section: 'A',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const baseTimetable: TimetableWithEntries = {
    id: 'tt-100',
    user_id: 'user-100',
    academic_year_id: null,
    name: 'Fall 2026 CS Timetable',
    effective_from: '2026-08-01',
    effective_to: null,
    timezone: 'Asia/Kolkata',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    entries: [],
  };

  it('identifies current active class and next class today during class hours', () => {
    const timetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [
        createMockEntry('e1', 'monday', '09:00', '10:00', 'Data Structures'),
        createMockEntry('e2', 'monday', '10:15', '11:15', 'Operating Systems'),
        createMockEntry('e3', 'monday', '11:30', '12:30', 'Algorithms'),
      ],
    };

    // Simulate Monday at 10:30 (during Operating Systems)
    const result = SchedulingService.calculateScheduleFromTimetable(
      timetable,
      'monday',
      '2026-09-07',
      '10:30:00',
      '10:30',
      630, // 10 * 60 + 30
      'Asia/Kolkata'
    );

    expect(result.todayClasses).toHaveLength(3);
    expect(result.todayClasses[0].status).toBe('completed');
    expect(result.todayClasses[1].status).toBe('current');
    expect(result.todayClasses[2].status).toBe('upcoming');

    // Current class check
    expect(result.currentClass).not.toBeNull();
    expect(result.currentClass?.id).toBe('e2');
    expect(result.currentClass?.subject_name).toBe('Operating Systems');

    // Next class check
    expect(result.nextClass).not.toBeNull();
    expect(result.nextClass?.id).toBe('e3');
    expect(result.nextClass?.subject_name).toBe('Algorithms');
    expect(result.nextClass?.isToday).toBe(true);
    expect(result.nextClass?.targetDay).toBe('monday');
  });

  it('returns null current class and upcoming next class during breaks', () => {
    const timetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [
        createMockEntry('e1', 'monday', '09:00', '10:00', 'Data Structures'),
        createMockEntry('e2', 'monday', '10:30', '11:30', 'Operating Systems'),
      ],
    };

    // Simulate Monday at 10:10 (break between e1 and e2)
    const result = SchedulingService.calculateScheduleFromTimetable(
      timetable,
      'monday',
      '2026-09-07',
      '10:10:00',
      '10:10',
      610,
      'Asia/Kolkata'
    );

    expect(result.currentClass).toBeNull();
    expect(result.nextClass).not.toBeNull();
    expect(result.nextClass?.id).toBe('e2');
    expect(result.nextClass?.subject_name).toBe('Operating Systems');
    expect(result.nextClass?.isToday).toBe(true);
  });

  it('determines next class across future days when all classes today have completed', () => {
    const timetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [
        createMockEntry('e1', 'monday', '09:00', '10:00', 'Data Structures'),
        createMockEntry('e2', 'monday', '10:15', '11:15', 'Operating Systems'),
        createMockEntry('e3', 'tuesday', '09:30', '10:30', 'Database Systems'),
        createMockEntry('e4', 'thursday', '14:00', '15:00', 'Computer Networks'),
      ],
    };

    // Simulate Monday at 17:00 (evening after all Monday classes ended)
    const result = SchedulingService.calculateScheduleFromTimetable(
      timetable,
      'monday',
      '2026-09-07',
      '17:00:00',
      '17:00',
      1020,
      'Asia/Kolkata'
    );

    expect(result.todayClasses).toHaveLength(2);
    expect(result.todayClasses[0].status).toBe('completed');
    expect(result.todayClasses[1].status).toBe('completed');
    expect(result.currentClass).toBeNull();

    // Next class should seamlessly find the Tuesday 09:30 class
    expect(result.nextClass).not.toBeNull();
    expect(result.nextClass?.id).toBe('e3');
    expect(result.nextClass?.subject_name).toBe('Database Systems');
    expect(result.nextClass?.targetDay).toBe('tuesday');
    expect(result.nextClass?.isToday).toBe(false);
  });

  it('correctly handles days with zero classes scheduled and searches future days', () => {
    const timetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [
        createMockEntry('e1', 'wednesday', '10:00', '11:00', 'Web Engineering'),
      ],
    };

    // Simulate Sunday at 12:00
    const result = SchedulingService.calculateScheduleFromTimetable(
      timetable,
      'sunday',
      '2026-09-13',
      '12:00:00',
      '12:00',
      720,
      'Asia/Kolkata'
    );

    expect(result.todayClasses).toEqual([]);
    expect(result.currentClass).toBeNull();
    expect(result.nextClass).not.toBeNull();
    expect(result.nextClass?.id).toBe('e1');
    expect(result.nextClass?.targetDay).toBe('wednesday');
    expect(result.nextClass?.isToday).toBe(false);
  });

  it('returns empty states safely when timetable has zero entries across entire week', () => {
    const emptyTimetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [],
    };

    const result = SchedulingService.calculateScheduleFromTimetable(
      emptyTimetable,
      'monday',
      '2026-09-07',
      '10:00:00',
      '10:00',
      600,
      'Asia/Kolkata'
    );

    expect(result.hasTimetable).toBe(true);
    expect(result.todayClasses).toEqual([]);
    expect(result.currentClass).toBeNull();
    expect(result.nextClass).toBeNull();
  });

  it('guarantees chronological sorting of entries regardless of insertion order', () => {
    const timetable: TimetableWithEntries = {
      ...baseTimetable,
      entries: [
        // Intentionally unsorted entries
        createMockEntry('e3', 'friday', '14:00', '15:00', 'Physics Lab'),
        createMockEntry('e1', 'friday', '08:30', '09:30', 'Calculus III'),
        createMockEntry('e2', 'friday', '10:00', '11:00', 'Discrete Math'),
      ],
    };

    const result = SchedulingService.calculateScheduleFromTimetable(
      timetable,
      'friday',
      '2026-09-11',
      '07:00:00',
      '07:00',
      420,
      'Asia/Kolkata'
    );

    expect(result.todayClasses.map((c) => c.id)).toEqual(['e1', 'e2', 'e3']);
    expect(result.nextClass?.id).toBe('e1');
  });
});
