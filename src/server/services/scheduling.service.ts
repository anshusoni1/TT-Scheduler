import type {
  TypedSupabaseClient,
  TimetableEntry,
  DayOfWeek,
  CalendarEvent,
  ScheduleException,
} from '@/types/database';
import { TimetablesRepository, type TimetableWithEntries } from '@/server/repositories/timetables.repository';
import { CalendarsRepository, type CalendarWithEvents } from '@/server/repositories/calendars.repository';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { getCurrentDateTimeInTimezone, getNextDaysOfWeek, timeToMinutes, getDatesBetween, DAYS_OF_WEEK } from '@/lib/dates';

export type ClassSlotStatus = 'current' | 'completed' | 'upcoming';

export interface TodayScheduleClass extends TimetableEntry {
  status: ClassSlotStatus;
  isOverride?: boolean;
  overrideType?: string;
}

export interface SynthesizedDaySchedule {
  dateString: string;
  dayOfWeek: DayOfWeek;
  isHoliday: boolean;
  isTeachingDay: boolean;
  holidayTitle: string | null;
  scheduleNote: string | null;
  events: CalendarEvent[];
  classes: TodayScheduleClass[];
}

export interface SubjectAttendanceMetrics {
  subject_name: string;
  subject_code: string | null;
  total_scheduled: number;
  classes_held_to_date: number;
  remaining_classes: number;
  safe_cuts_allowance: number;
  minimum_classes_needed: number;
}

export interface AttendanceAnalyticsResult {
  academic_year: string | null;
  semester_range: {
    start_date: string;
    end_date: string;
  };
  total_teaching_days: number;
  total_holidays: number;
  total_classes_semester: number;
  classes_held_to_date: number;
  target_percentage: number;
  subjects: SubjectAttendanceMetrics[];
}

export interface NextClassInfo extends TimetableEntry {
  targetDay: DayOfWeek;
  targetDate?: string;
  isToday: boolean;
}

export interface TodayScheduleResult {
  hasTimetable: boolean;
  timetableId?: string;
  timetableName?: string;
  hasCalendar: boolean;
  calendarId?: string;
  calendarName?: string;
  timezone: string;
  dateString: string;
  timeString: string;
  dayOfWeek: DayOfWeek;
  isHoliday: boolean;
  isTeachingDay: boolean;
  holidayTitle: string | null;
  todayEvents: CalendarEvent[];
  upcomingHolidays: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  todayClasses: TodayScheduleClass[];
  currentClass: TodayScheduleClass | null;
  nextClass: NextClassInfo | null;
  scheduleNote?: string | null;
}

export class SchedulingService {
  /**
   * Deterministically calculates whether a given date is an instructional teaching day.
   * Priority:
   * 1. Explicit schedule exception (date_holiday -> false, date_teaching_day -> true).
   * 2. Academic calendar event (holiday -> false, teaching_day/working_day -> true).
   * 3. Recurring timetable (weekday has classes scheduled -> true, else false).
   */
  static async isTeachingDay(
    supabase: TypedSupabaseClient,
    userId: string,
    targetDate: string
  ): Promise<boolean> {
    const exceptionsRepo = new ExceptionsRepository(supabase);
    const calendarsRepo = new CalendarsRepository(supabase);
    const timetablesRepo = new TimetablesRepository(supabase);

    const [exceptions, events, activeTimetable]: [
      ScheduleException[],
      CalendarEvent[],
      TimetableWithEntries | null
    ] = await Promise.all([
      exceptionsRepo.getExceptionsForDate(userId, targetDate),
      calendarsRepo.getEventsForDate(userId, targetDate),
      timetablesRepo.getActiveTimetable(userId),
    ]);

    // 1. Check schedule exceptions (Highest Priority)
    const holidayException = exceptions.find((e) => e.exception_type === 'date_holiday');
    if (holidayException) return false;

    const teachingDayException = exceptions.find((e) => e.exception_type === 'date_teaching_day');
    if (teachingDayException) return true;

    // 2. Check academic calendar events
    const holidayEvent = events.find((e) => e.is_holiday || e.event_type === 'holiday' || e.event_type === 'recess');
    if (holidayEvent) return false;

    const teachingEvent = events.find(
      (e) => e.is_teaching_day || e.event_type === 'teaching_day' || e.event_type === 'working_day' || e.event_type === 'special_teaching_day'
    );
    if (teachingEvent) return true;

    // 3. Fallback to timetable-only behavior
    if (activeTimetable) {
      // Determine day of week from date
      const parsedDate = new Date(`${targetDate}T00:00:00Z`);
      const utcDay = parsedDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayMap[utcDay];

      const hasClassesOnDay = activeTimetable.entries.some((e) => e.day_of_week === dayOfWeek);
      return hasClassesOnDay;
    }

    return false;
  }

  /**
   * Deterministically calculates today's combined schedule, teaching/holiday status,
   * current class, and next class for a student.
   * Priority cascade: Exception > Calendar Override > Recurring Timetable > Empty.
   */
  static async getTodaySchedule(
    supabase: TypedSupabaseClient,
    userId: string,
    referenceDate = new Date()
  ): Promise<TodayScheduleResult> {
    const profilesRepo = new ProfilesRepository(supabase);
    const timetablesRepo = new TimetablesRepository(supabase);
    const calendarsRepo = new CalendarsRepository(supabase);
    const exceptionsRepo = new ExceptionsRepository(supabase);

    const [profile, activeTimetable, activeCalendar] = await Promise.all([
      profilesRepo.getProfile(userId),
      timetablesRepo.getActiveTimetable(userId),
      calendarsRepo.getActiveCalendar(userId),
    ]);

    const timezone = profile?.timezone || 'Asia/Kolkata';
    const { dateString, timeString, timeHM, dayOfWeek, currentTimeMinutes } =
      getCurrentDateTimeInTimezone(timezone, referenceDate);

    // Fetch date-specific exceptions and upcoming calendar items in parallel
    const [todayExceptions, upcomingHolidays, upcomingEvents] = await Promise.all([
      exceptionsRepo.getExceptionsForDate(userId, dateString),
      activeCalendar ? calendarsRepo.getUpcomingHolidays(userId, dateString, 3) : Promise.resolve([]),
      activeCalendar ? calendarsRepo.getUpcomingEvents(userId, dateString, 3) : Promise.resolve([]),
    ]);

    // Events for today from active calendar
    const todayEvents = activeCalendar
      ? activeCalendar.events.filter((e) => e.event_date === dateString)
      : [];

    return this.calculateScheduleWithOverrides(
      activeTimetable,
      activeCalendar,
      todayEvents,
      todayExceptions,
      upcomingHolidays,
      upcomingEvents,
      dayOfWeek,
      dateString,
      timeString,
      timeHM,
      currentTimeMinutes,
      timezone
    );
  }

  /**
   * Deterministic timetable-only schedule calculation function (Phase 4 compatibility).
   */
  static calculateScheduleFromTimetable(
    timetable: TimetableWithEntries | null,
    dayOfWeek: DayOfWeek,
    dateString: string,
    timeString: string,
    timeHM: string,
    currentTimeMinutes: number,
    timezone: string
  ): TodayScheduleResult {
    return this.calculateScheduleWithOverrides(
      timetable,
      null,
      [],
      [],
      [],
      [],
      dayOfWeek,
      dateString,
      timeString,
      timeHM,
      currentTimeMinutes,
      timezone
    );
  }

  /**
   * Pure deterministic schedule calculation function with 4-tier priority cascade.
   * 1. Explicit Schedule Exception
   * 2. Academic Calendar Override
   * 3. Recurring Timetable
   * 4. No Schedule
   */
  static calculateScheduleWithOverrides(
    timetable: TimetableWithEntries | null,
    calendar: CalendarWithEvents | null,
    todayEvents: CalendarEvent[],
    todayExceptions: ScheduleException[],
    upcomingHolidays: CalendarEvent[],
    upcomingEvents: CalendarEvent[],
    dayOfWeek: DayOfWeek,
    dateString: string,
    timeString: string,
    timeHM: string,
    currentTimeMinutes: number,
    timezone: string
  ): TodayScheduleResult {
    // -------------------------------------------------------------
    // TIER 1 & 2: Holiday & Teaching Day Evaluation
    // -------------------------------------------------------------
    let isHoliday = false;
    let isTeachingDay = false;
    let holidayTitle: string | null = null;
    let scheduleNote: string | null = null;

    // Check date-level schedule exceptions (Tier 1)
    const dateHolidayException = todayExceptions.find((e) => e.exception_type === 'date_holiday');
    const dateTeachingException = todayExceptions.find((e) => e.exception_type === 'date_teaching_day');

    if (dateHolidayException) {
      isHoliday = true;
      isTeachingDay = false;
      holidayTitle = dateHolidayException.reason || 'Holiday (Date Exception)';
      scheduleNote = 'Regular classes suspended due to schedule override.';
    } else if (dateTeachingException) {
      isHoliday = false;
      isTeachingDay = true;
      scheduleNote = 'Special teaching day conducted by schedule override.';
    } else {
      // Check calendar events for today (Tier 2)
      const holidayEvent = todayEvents.find((e) => e.is_holiday || e.event_type === 'holiday' || e.event_type === 'recess');
      if (holidayEvent) {
        isHoliday = true;
        isTeachingDay = false;
        holidayTitle = holidayEvent.title;
        scheduleNote = holidayEvent.description || 'Academic calendar official holiday.';
      } else {
        const teachingEvent = todayEvents.find(
          (e) => e.is_teaching_day || e.event_type === 'teaching_day' || e.event_type === 'working_day' || e.event_type === 'special_teaching_day'
        );
        if (teachingEvent) {
          isTeachingDay = true;
          if (teachingEvent.event_type === 'working_day') {
            scheduleNote = `${teachingEvent.title} (Working Day)`;
          }
        } else if (timetable) {
          // Tier 3: Timetable default
          isTeachingDay = timetable.entries.some((e) => e.day_of_week === dayOfWeek);
        }
      }
    }

    // -------------------------------------------------------------
    // TIER 3: Base Class Slots Assembly (Timetable + Overrides)
    // -------------------------------------------------------------
    let candidateEntries: TimetableEntry[] = [];

    // If today is a holiday and normal timetable is affected, do NOT include recurring classes
    const suppressRegularClasses = isHoliday && !dateTeachingException;

    let isDaySubstituted = false;

    if (!suppressRegularClasses && timetable) {
      // Check if a working day event specifies a follows_day (e.g. Working Saturday following Monday)
      const workingDayEvent = todayEvents.find((e) => e.event_type === 'working_day' || e.event_type === 'special_teaching_day');
      let effectiveDay: DayOfWeek = dayOfWeek;

      if (workingDayEvent) {
        const meta = (workingDayEvent.metadata as Record<string, unknown>) || {};
        const specifiedDay = (meta.follows_day || meta.observed_day || meta.observedDay) as string | undefined;

        if (specifiedDay && DAYS_OF_WEEK.includes(specifiedDay.toLowerCase() as DayOfWeek)) {
          effectiveDay = specifiedDay.toLowerCase() as DayOfWeek;
          isDaySubstituted = effectiveDay !== dayOfWeek;
          scheduleNote = `Operating on ${specifiedDay} schedule (${workingDayEvent.title})`;
        } else {
          // Check event title or description for day substitution (e.g. "Monday schedule" or "Mon Timetable")
          const text = `${workingDayEvent.title} ${workingDayEvent.description || ''}`.toLowerCase();
          for (const d of DAYS_OF_WEEK) {
            if (
              text.includes(`${d} schedule`) ||
              text.includes(`${d} timetable`) ||
              text.includes(`observe ${d}`) ||
              text.includes(`observing ${d}`) ||
              text.includes(`(${d.slice(0, 3)} timetable)`) ||
              text.includes(`(${d.slice(0, 3)} schedule)`)
            ) {
              effectiveDay = d;
              isDaySubstituted = effectiveDay !== dayOfWeek;
              scheduleNote = `Operating on ${d} schedule (${workingDayEvent.title})`;
              break;
            }
          }
        }
      }

      candidateEntries = timetable.entries
        .filter((e) => e.day_of_week === effectiveDay)
        .map((e) => ({ ...e }));
    }

    // Apply class-specific schedule exceptions (Tier 1)
    // 1. Filter out cancelled classes
    const cancelledEntryIds = new Set(
      todayExceptions
        .filter((e) => e.exception_type === 'cancelled' && e.original_timetable_entry_id)
        .map((e) => e.original_timetable_entry_id!)
    );

    let adjustedEntries = candidateEntries.filter((e) => !cancelledEntryIds.has(e.id));

    // Also filter by subject/time if cancellation doesn't specify original_timetable_entry_id
    const anonymousCancellations = todayExceptions.filter(
      (e) => e.exception_type === 'cancelled' && !e.original_timetable_entry_id && e.subject_name
    );
    if (anonymousCancellations.length > 0) {
      adjustedEntries = adjustedEntries.filter((entry) => {
        return !anonymousCancellations.some(
          (c) => c.subject_name?.toLowerCase() === entry.subject_name.toLowerCase()
        );
      });
    }

    // 2. Apply modifications (room_change, rescheduled, substitute)
    adjustedEntries = adjustedEntries.map((entry) => {
      const match = todayExceptions.find((ex) => ex.original_timetable_entry_id === entry.id);
      if (!match) return entry;

      const modified = { ...entry };
      if (match.exception_type === 'room_change' && match.room) {
        modified.room = match.room;
        modified.notes = `${entry.notes ? entry.notes + ' • ' : ''}Room change: ${match.room}`;
      } else if (match.exception_type === 'rescheduled') {
        if (match.start_time) modified.start_time = match.start_time;
        if (match.end_time) modified.end_time = match.end_time;
        modified.notes = `${entry.notes ? entry.notes + ' • ' : ''}Rescheduled time`;
      } else if (match.exception_type === 'substitute') {
        if (match.subject_name) modified.subject_name = match.subject_name;
        modified.notes = `${entry.notes ? entry.notes + ' • ' : ''}${match.reason || 'Substitute session'}`;
      }
      return modified;
    });

    // 3. Append extra classes (extra_class)
    const extraClassExceptions = todayExceptions.filter(
      (e) => e.exception_type === 'extra_class' && e.subject_name && e.start_time && e.end_time
    );

    for (const extra of extraClassExceptions) {
      adjustedEntries.push({
        id: extra.id,
        timetable_id: timetable?.id || 'manual-override',
        day_of_week: dayOfWeek,
        start_time: extra.start_time!,
        end_time: extra.end_time!,
        subject_name: extra.subject_name!,
        subject_code: null,
        faculty_name: null,
        room: extra.room || null,
        class_type: 'lecture',
        section: null,
        notes: extra.reason || 'Extra class added via schedule override',
        created_at: extra.created_at,
        updated_at: extra.updated_at,
      });
    }

    // Sort strictly ascending by start_time
    adjustedEntries.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // -------------------------------------------------------------
    // Status Resolution: Current & Next Class Calculation
    // -------------------------------------------------------------
    let currentClass: TodayScheduleClass | null = null;
    let nextClassToday: NextClassInfo | null = null;

    const todayClasses: TodayScheduleClass[] = adjustedEntries.map((entry) => {
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);

      let status: ClassSlotStatus = 'upcoming';
      if (currentTimeMinutes >= startMin && currentTimeMinutes < endMin) {
        status = 'current';
      } else if (currentTimeMinutes >= endMin) {
        status = 'completed';
      } else {
        status = 'upcoming';
      }

      const isOverride = isDaySubstituted || todayExceptions.some(
        (ex) => ex.original_timetable_entry_id === entry.id || ex.id === entry.id
      );

      const scheduledClass: TodayScheduleClass = {
        ...entry,
        status,
        isOverride,
      };

      if (status === 'current' && !currentClass) {
        currentClass = scheduledClass;
      }

      if (status === 'upcoming' && !nextClassToday) {
        nextClassToday = {
          ...entry,
          targetDay: dayOfWeek,
          targetDate: dateString,
          isToday: true,
        };
      }

      return scheduledClass;
    });

    // -------------------------------------------------------------
    // Next Class Future Resolution
    // If no upcoming class remains today, search future days
    // -------------------------------------------------------------
    let nextClass: NextClassInfo | null = nextClassToday;

    if (!nextClass && timetable) {
      const futureDays = getNextDaysOfWeek(dayOfWeek);

      for (let i = 0; i < futureDays.length; i++) {
        const nextDay = futureDays[i];

        // Approximate future date string YYYY-MM-DD
        const futureDateObj = new Date(`${dateString}T00:00:00Z`);
        futureDateObj.setUTCDate(futureDateObj.getUTCDate() + (i + 1));
        const futureDateStr = futureDateObj.toISOString().slice(0, 10);

        // Check if future day is an academic calendar holiday
        const isFutureHoliday = calendar?.events.some(
          (e) => e.event_date === futureDateStr && (e.is_holiday || e.event_type === 'holiday' || e.event_type === 'recess')
        );
        if (isFutureHoliday) {
          continue; // Skip holiday day
        }

        const nextDayEntries = timetable.entries
          .filter((entry) => entry.day_of_week === nextDay)
          .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

        if (nextDayEntries.length > 0) {
          nextClass = {
            ...nextDayEntries[0],
            targetDay: nextDay,
            targetDate: futureDateStr,
            isToday: false,
          };
          break;
        }
      }
    }

    return {
      hasTimetable: !!timetable,
      timetableId: timetable?.id,
      timetableName: timetable?.name,
      hasCalendar: !!calendar,
      calendarId: calendar?.id,
      calendarName: calendar?.name,
      timezone,
      dateString,
      timeString,
      dayOfWeek,
      isHoliday,
      isTeachingDay,
      holidayTitle,
      todayEvents,
      upcomingHolidays,
      upcomingEvents,
      todayClasses,
      currentClass,
      nextClass,
      scheduleNote,
    };
  }

  /**
   * Synthesizes all class sessions, holiday states, and calendar events across an arbitrary date range.
   * Deterministically processes every date using the 4-tier cascade.
   */
  static async synthesizeScheduleForRange(
    supabase: TypedSupabaseClient,
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SynthesizedDaySchedule[]> {
    const timetablesRepo = new TimetablesRepository(supabase);
    const calendarsRepo = new CalendarsRepository(supabase);
    const exceptionsRepo = new ExceptionsRepository(supabase);
    const profilesRepo = new ProfilesRepository(supabase);

    const profile = await profilesRepo.getProfile(userId);
    const timezone = profile?.timezone || 'Asia/Kolkata';

    const [timetable, calendar, exceptions] = await Promise.all([
      timetablesRepo.getActiveTimetable(userId),
      calendarsRepo.getActiveCalendar(userId),
      exceptionsRepo.getUserExceptions(userId),
    ]);

    const dateStrings = getDatesBetween(startDate, endDate);
    const result: SynthesizedDaySchedule[] = [];

    for (const dateStr of dateStrings) {
      const dateObj = new Date(`${dateStr}T00:00:00Z`);
      const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[dateObj.getUTCDay()];

      // Filter events and exceptions for this date
      const dayEvents = calendar
        ? calendar.events.filter((e) => e.event_date === dateStr)
        : [];
      const dayExceptions = exceptions.filter((ex) => ex.date === dateStr);

      // Evaluate schedule as of 00:00:00 to get all classes for the day
      const daySchedule = this.calculateScheduleWithOverrides(
        timetable,
        calendar,
        dayEvents,
        dayExceptions,
        [],
        [],
        dayOfWeek,
        dateStr,
        '00:00:00',
        '00:00',
        0,
        timezone
      );

      result.push({
        dateString: dateStr,
        dayOfWeek,
        isHoliday: daySchedule.isHoliday,
        isTeachingDay: daySchedule.isTeachingDay,
        holidayTitle: daySchedule.holidayTitle,
        scheduleNote: daySchedule.scheduleNote || null,
        events: dayEvents,
        classes: daySchedule.todayClasses,
      });
    }

    return result;
  }

  /**
   * Calculates semester attendance metrics, total teaching days, and safe cuts margins.
   */
  static async calculateAttendanceAnalytics(
    supabase: TypedSupabaseClient,
    userId: string,
    targetPercentage = 75
  ): Promise<AttendanceAnalyticsResult> {
    const calendarsRepo = new CalendarsRepository(supabase);
    const profilesRepo = new ProfilesRepository(supabase);
    const profile = await profilesRepo.getProfile(userId);
    const timezone = profile?.timezone || 'Asia/Kolkata';

    const calendar = await calendarsRepo.getActiveCalendar(userId);
    const now = getCurrentDateTimeInTimezone(timezone);

    // If calendar exists and has bounds, use them; otherwise use 4-month window around now
    let startDate = calendar?.effective_from;
    let endDate = calendar?.effective_to;

    if (!startDate || !endDate) {
      const nowObj = new Date(`${now.dateString}T00:00:00Z`);
      const start = new Date(nowObj);
      start.setUTCMonth(start.getUTCMonth() - 1);
      start.setUTCDate(1);
      const end = new Date(nowObj);
      end.setUTCMonth(end.getUTCMonth() + 3);
      end.setUTCDate(28);

      startDate = startDate || start.toISOString().slice(0, 10);
      endDate = endDate || end.toISOString().slice(0, 10);
    }

    const synthesizedDays = await this.synthesizeScheduleForRange(
      supabase,
      userId,
      startDate,
      endDate
    );

    let totalTeachingDays = 0;
    let totalHolidays = 0;
    let totalClassesSemester = 0;
    let classesHeldToDate = 0;

    const subjectsMap = new Map<string, {
      subject_name: string;
      subject_code: string | null;
      total_scheduled: number;
      classes_held_to_date: number;
    }>();

    for (const day of synthesizedDays) {
      if (day.isHoliday) totalHolidays++;
      if (day.isTeachingDay) totalTeachingDays++;

      const isPastOrToday = day.dateString <= now.dateString;

      for (const cls of day.classes) {
        totalClassesSemester++;
        if (isPastOrToday) classesHeldToDate++;

        const key = cls.subject_name.trim().toLowerCase();
        let existing = subjectsMap.get(key);
        if (!existing) {
          existing = {
            subject_name: cls.subject_name.trim(),
            subject_code: cls.subject_code || null,
            total_scheduled: 0,
            classes_held_to_date: 0,
          };
          subjectsMap.set(key, existing);
        }

        existing.total_scheduled++;
        if (isPastOrToday) {
          existing.classes_held_to_date++;
        }
      }
    }

    const subjects: SubjectAttendanceMetrics[] = Array.from(subjectsMap.values()).map((sub) => {
      const remainingClasses = Math.max(0, sub.total_scheduled - sub.classes_held_to_date);
      const safeCutsAllowance = Math.max(0, Math.floor(sub.total_scheduled * (1 - targetPercentage / 100)));
      const minimumClassesNeeded = Math.ceil(sub.total_scheduled * (targetPercentage / 100));

      return {
        subject_name: sub.subject_name,
        subject_code: sub.subject_code,
        total_scheduled: sub.total_scheduled,
        classes_held_to_date: sub.classes_held_to_date,
        remaining_classes: remainingClasses,
        safe_cuts_allowance: safeCutsAllowance,
        minimum_classes_needed: minimumClassesNeeded,
      };
    });

    return {
      academic_year: null,
      semester_range: {
        start_date: startDate,
        end_date: endDate,
      },
      total_teaching_days: totalTeachingDays,
      total_holidays: totalHolidays,
      total_classes_semester: totalClassesSemester,
      classes_held_to_date: classesHeldToDate,
      target_percentage: targetPercentage,
      subjects,
    };
  }
}
