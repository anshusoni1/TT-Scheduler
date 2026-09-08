import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { generateICalendar, type ICalEventInput } from '@/lib/ical';
import { handleApiError } from '@/lib/errors';
import { getCurrentDateTimeInTimezone } from '@/lib/dates';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const { searchParams } = new URL(request.url);
    const calendarsRepo = new CalendarsRepository(supabase);
    const timetablesRepo = new TimetablesRepository(supabase);

    const [activeCalendar, activeTimetable] = await Promise.all([
      calendarsRepo.getActiveCalendar(user.id),
      timetablesRepo.getActiveTimetable(user.id),
    ]);

    const now = getCurrentDateTimeInTimezone();
    let startDate = searchParams.get('from') || activeCalendar?.effective_from;
    let endDate = searchParams.get('to') || activeCalendar?.effective_to;

    if (!startDate || !endDate) {
      const nowObj = new Date(`${now.dateString}T00:00:00Z`);
      const start = new Date(nowObj);
      start.setUTCDate(1);
      const end = new Date(nowObj);
      end.setUTCMonth(end.getUTCMonth() + 4);
      end.setUTCDate(28);

      startDate = startDate || start.toISOString().slice(0, 10);
      endDate = endDate || end.toISOString().slice(0, 10);
    }

    const synthesizedDays = await SchedulingService.synthesizeScheduleForRange(
      supabase,
      user.id,
      startDate,
      endDate
    );

    const icalEvents: ICalEventInput[] = [];

    for (const day of synthesizedDays) {
      // 1. Add class sessions
      for (const cls of day.classes) {
        const typeLabel = cls.class_type ? `[${cls.class_type.toUpperCase()}] ` : '';
        const roomStr = cls.room ? `Room: ${cls.room}` : '';
        const facultyStr = cls.faculty_name ? `Faculty: ${cls.faculty_name}` : '';
        const sectionStr = cls.section ? `Section: ${cls.section}` : '';
        const descParts = [
          cls.subject_code ? `Code: ${cls.subject_code}` : '',
          facultyStr,
          roomStr,
          sectionStr,
          cls.notes ? `Notes: ${cls.notes}` : '',
        ].filter(Boolean);

        icalEvents.push({
          uid: `cf-class-${cls.id}-${day.dateString}@classflow.app`,
          summary: `${typeLabel}${cls.subject_name}`,
          startDate: day.dateString,
          startTime: cls.start_time,
          endDate: day.dateString,
          endTime: cls.end_time,
          location: cls.room || undefined,
          description: descParts.join('\n'),
          timezone: now.dateString ? 'Asia/Kolkata' : undefined,
          alarmMinutesBefore: 15,
        });
      }

      // 2. Add full-day holidays if present
      if (day.isHoliday && day.holidayTitle) {
        icalEvents.push({
          uid: `cf-holiday-${day.dateString}@classflow.app`,
          summary: `Holiday: ${day.holidayTitle}`,
          startDate: day.dateString,
          startTime: '00:00:00',
          endDate: day.dateString,
          endTime: '23:59:59',
          description: day.scheduleNote || 'Institutional Holiday - No Regular Classes',
          alarmMinutesBefore: 0,
        });
      }
    }

    const calendarTitle = activeTimetable?.name
      ? `ClassFlow - ${activeTimetable.name}`
      : 'ClassFlow Academic Schedule';

    const icsString = generateICalendar(calendarTitle, icalEvents, 'Asia/Kolkata');

    return new Response(icsString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="classflow-schedule.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
