import type { TypedSupabaseClient } from '@/types/database';
import { SchedulingService } from './scheduling.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { getCurrentDateTimeInTimezone, timeToMinutes } from '@/lib/dates';

export type ReminderType = 'morning_schedule' | 'next_class' | 'holiday_alert' | 'exam_alert';

export interface AcademicReminder {
  id: string;
  type: ReminderType;
  title: string;
  message: string;
  dueTime: string;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Evaluates real academic data to compute active reminders for the authenticated student.
   * Does not fabricate push deliveries or simulate network notifications.
   */
  static async getActiveReminders(
    supabase: TypedSupabaseClient,
    userId: string,
    timezone = 'Asia/Kolkata'
  ): Promise<AcademicReminder[]> {
    const reminders: AcademicReminder[] = [];
    const { dateString, timeString } = getCurrentDateTimeInTimezone(timezone);
    const currentMinutes = timeToMinutes(timeString);

    // 1. Fetch today's schedule
    const todaySchedule = await SchedulingService.getTodaySchedule(supabase, userId);

    // Morning Schedule Briefing (if within morning hours, e.g., 07:00 - 10:00)
    if (currentMinutes >= 420 && currentMinutes <= 600) {
      if (todaySchedule.isHoliday) {
        reminders.push({
          id: `morning-holiday-${dateString}`,
          type: 'holiday_alert',
          title: `Today is a Holiday: ${todaySchedule.holidayTitle || 'No Classes'}`,
          message: 'Enjoy your day off! No regular academic classes are scheduled.',
          dueTime: '08:00',
        });
      } else if (todaySchedule.todayClasses.length > 0) {
        reminders.push({
          id: `morning-schedule-${dateString}`,
          type: 'morning_schedule',
          title: `You have ${todaySchedule.todayClasses.length} classes scheduled today`,
          message: `First class starts at ${todaySchedule.todayClasses[0].start_time.slice(0, 5)}: ${todaySchedule.todayClasses[0].subject_name}.`,
          dueTime: '08:00',
          metadata: { classCount: todaySchedule.todayClasses.length },
        });
      }
    }

    // Next Class Reminder (if a class is starting in the next 15-30 minutes)
    for (const cls of todaySchedule.todayClasses) {
      const classStartMinutes = timeToMinutes(cls.start_time);
      const minutesUntilClass = classStartMinutes - currentMinutes;

      if (minutesUntilClass > 0 && minutesUntilClass <= 30) {
        reminders.push({
          id: `next-class-${cls.id}-${dateString}`,
          type: 'next_class',
          title: `Upcoming: ${cls.subject_name} in ${minutesUntilClass} minutes`,
          message: `Scheduled at ${cls.start_time.slice(0, 5)} in ${cls.room || 'assigned room'}${cls.faculty_name ? ` by ${cls.faculty_name}` : ''}.`,
          dueTime: cls.start_time.slice(0, 5),
          metadata: { timetableEntryId: cls.id, room: cls.room },
        });
      }
    }

    // Upcoming Exam or Special Event alerts (within next 7 days)
    const calendarsRepo = new CalendarsRepository(supabase);
    const activeCal = await calendarsRepo.getActiveCalendar(userId);

    if (activeCal) {
      const events = activeCal.events || [];

      for (const ev of events) {
        if (ev.event_type === 'exam' && ev.event_date >= dateString) {
          reminders.push({
            id: `exam-${ev.id}`,
            type: 'exam_alert',
            title: `Upcoming Exam: ${ev.title}`,
            message: `Scheduled on ${ev.event_date}${ev.description ? ` (${ev.description})` : ''}.`,
            dueTime: ev.event_date,
            metadata: { eventId: ev.id, date: ev.event_date },
          });
        }
      }
    }

    return reminders;
  }
}
