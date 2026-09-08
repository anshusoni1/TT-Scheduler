import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { CalendarFeedRepository } from '@/server/repositories/calendar-feed.repository';
import { SchedulingService } from '@/server/services/scheduling.service';
import { generateICalendar, type ICalEventInput } from '@/lib/ical';
import { getCurrentDateTimeInTimezone } from '@/lib/dates';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) {
      return new Response('Invalid calendar feed token.', { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const feedRepo = new CalendarFeedRepository(adminSupabase);
    const feedTokenRecord = await feedRepo.findActiveToken(token);

    if (!feedTokenRecord || !feedTokenRecord.active) {
      return new Response('Calendar subscription feed not found or expired.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const userId = feedTokenRecord.user_id;
    const calendarsRepo = new CalendarsRepository(adminSupabase);
    const timetablesRepo = new TimetablesRepository(adminSupabase);

    const [activeCalendar, activeTimetable] = await Promise.all([
      calendarsRepo.getActiveCalendar(userId),
      timetablesRepo.getActiveTimetable(userId),
    ]);

    const now = getCurrentDateTimeInTimezone();
    const nowObj = new Date(`${now.dateString}T00:00:00Z`);

    // Dynamic forward 90 days window
    const startObj = new Date(nowObj);
    startObj.setUTCDate(startObj.getUTCDate() - 7); // include 1 past week
    const endObj = new Date(nowObj);
    endObj.setUTCDate(endObj.getUTCDate() + 90); // forward 90 days

    const startDate = activeCalendar?.effective_from && activeCalendar.effective_from > startObj.toISOString().slice(0, 10)
      ? activeCalendar.effective_from
      : startObj.toISOString().slice(0, 10);

    const endDate = activeCalendar?.effective_to && activeCalendar.effective_to < endObj.toISOString().slice(0, 10)
      ? activeCalendar.effective_to
      : endObj.toISOString().slice(0, 10);

    const synthesizedDays = await SchedulingService.synthesizeScheduleForRange(
      adminSupabase,
      userId,
      startDate,
      endDate
    );

    const icalEvents: ICalEventInput[] = [];

    for (const day of synthesizedDays) {
      if (day.isHoliday) {
        icalEvents.push({
          uid: `cf-holiday-${day.dateString}@classflow.local`,
          summary: `[Holiday] ${day.holidayTitle || 'Academic Holiday'}`,
          description: day.scheduleNote || 'Institutional holiday - regular timetable classes suspended',
          startDate: day.dateString,
          startTime: '08:00',
          endDate: day.dateString,
          endTime: '18:00',
        });
        continue;
      }

      for (const ev of day.events) {
        if (ev.event_type !== 'holiday') {
          icalEvents.push({
            uid: `cf-event-${ev.id}@classflow.local`,
            summary: `[Academic] ${ev.title}`,
            description: ev.description || 'Academic event',
            startDate: day.dateString,
            startTime: '09:00',
            endDate: day.dateString,
            endTime: '17:00',
          });
        }
      }

      for (const cls of day.classes) {
        icalEvents.push({
          uid: `cf-feed-${cls.id}-${day.dateString}@classflow.local`,
          summary: cls.subject_code ? `${cls.subject_name} (${cls.subject_code})` : cls.subject_name,
          description: [
            `Class: ${cls.subject_name}`,
            cls.subject_code ? `Code: ${cls.subject_code}` : null,
            cls.class_type ? `Type: ${cls.class_type}` : null,
            cls.faculty_name ? `Faculty: ${cls.faculty_name}` : null,
            cls.room ? `Room: ${cls.room}` : null,
            cls.isOverride ? 'Status: Rescheduled / Override' : null,
            cls.notes ? `Notes: ${cls.notes}` : null,
          ]
            .filter(Boolean)
            .join('\\n'),
          location: cls.room || undefined,
          startDate: day.dateString,
          startTime: cls.start_time.slice(0, 5),
          endDate: day.dateString,
          endTime: cls.end_time.slice(0, 5),
        });
      }
    }

    const calendarTitle = activeTimetable?.name
      ? `ClassFlow - ${activeTimetable.name}`
      : 'ClassFlow Academic Schedule Feed';

    const icsString = generateICalendar(calendarTitle, icalEvents, 'Asia/Kolkata');

    return new Response(icsString, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Disposition': 'inline; filename="classflow-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    return new Response('Internal error rendering calendar feed.', { status: 500 });
  }
}
