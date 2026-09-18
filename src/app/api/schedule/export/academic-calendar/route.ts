import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { generateICalendar, type ICalEventInput, type ICalAlarmInput } from '@/lib/ical';
import { handleApiError } from '@/lib/errors';
import { getCurrentDateTimeInTimezone } from '@/lib/dates';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const { searchParams } = new URL(request.url);
    const calendarsRepo = new CalendarsRepository(supabase);

    const activeCalendar = await calendarsRepo.getActiveCalendar(user.id);

    const now = getCurrentDateTimeInTimezone();
    let startDate = searchParams.get('from') || activeCalendar?.effective_from;
    let endDate = searchParams.get('to') || activeCalendar?.effective_to;

    if (!startDate || !endDate) {
      const nowObj = new Date(`${now.dateString}T00:00:00Z`);
      const start = new Date(nowObj);
      start.setUTCDate(1);
      const end = new Date(nowObj);
      end.setUTCMonth(end.getUTCMonth() + 6);
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
    const processedEventIds = new Set<string>();

    for (const day of synthesizedDays) {
      if (day.events && day.events.length > 0) {
        for (const event of day.events) {
          if (processedEventIds.has(event.id)) {
            continue;
          }
          processedEventIds.add(event.id);

          const alarms: ICalAlarmInput[] = [];
          if (event.event_type === 'exam') {
            alarms.push({ trigger: '-P1W', description: `Reminder: ${event.title} is in 1 week` });
            alarms.push({ trigger: '-P3D', description: `Reminder: ${event.title} is in 3 days` });
            alarms.push({ trigger: '-P1D', description: `Reminder: ${event.title} is tomorrow` });
          }

          icalEvents.push({
            uid: `cf-event-${event.id}@classflow.app`,
            summary: event.title,
            startDate: event.event_date,
            startTime: '00:00:00',
            endDate: event.event_date,
            endTime: '23:59:59',
            description: event.description || '',
            timezone: 'Asia/Kolkata',
            alarms: alarms,
          });
        }
      } else if (day.isHoliday && day.holidayTitle) {
        // Fallback for holidays that might not be in day.events but are synthesized
        icalEvents.push({
          uid: `cf-holiday-${day.dateString}@classflow.app`,
          summary: `Holiday: ${day.holidayTitle}`,
          startDate: day.dateString,
          startTime: '00:00:00',
          endDate: day.dateString,
          endTime: '23:59:59',
          description: day.scheduleNote || 'Institutional Holiday',
          timezone: 'Asia/Kolkata',
        });
      }
    }

    const calendarTitle = activeCalendar?.name
      ? `NxtBell - ${activeCalendar.name} (Academic Calendar)`
      : 'NxtBell Academic Calendar';

    const icsString = generateICalendar(calendarTitle, icalEvents, 'Asia/Kolkata');

    return new Response(icsString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="nxtbell-academic-calendar.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
