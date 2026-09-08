import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import type { TimetableEntry, ScheduleException } from '@/types/database';
import { AppError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim().toLowerCase() || '';

    if (!query) {
      return NextResponse.json({
        success: true,
        data: {
          classes: [],
          events: [],
          exceptions: [],
        },
      });
    }

    const timetablesRepo = new TimetablesRepository(supabase);
    const calendarsRepo = new CalendarsRepository(supabase);
    const exceptionsRepo = new ExceptionsRepository(supabase);

    // Fetch active timetable, calendars, and exceptions concurrently
    const [activeTimetable, userCalendars, exceptions] = await Promise.all([
      timetablesRepo.getActiveTimetable(user.id),
      calendarsRepo.getUserCalendars(user.id),
      exceptionsRepo.getUserExceptions(user.id),
    ]);

    // 1. Filter timetable classes
    const matchedClasses = (activeTimetable?.entries || []).filter((entry: TimetableEntry) => {
      return (
        entry.subject_name.toLowerCase().includes(query) ||
        (entry.subject_code && entry.subject_code.toLowerCase().includes(query)) ||
        (entry.room && entry.room.toLowerCase().includes(query)) ||
        (entry.faculty_name && entry.faculty_name.toLowerCase().includes(query)) ||
        (entry.class_type && entry.class_type.toLowerCase().includes(query)) ||
        (entry.day_of_week && entry.day_of_week.toLowerCase().includes(query))
      );
    });

    // 2. Filter calendar events
    const matchedEvents = [];
    for (const cal of userCalendars) {
      for (const ev of cal.events || []) {
        if (
          ev.title.toLowerCase().includes(query) ||
          (ev.description && ev.description.toLowerCase().includes(query)) ||
          ev.event_type.toLowerCase().includes(query) ||
          ev.event_date.includes(query)
        ) {
          matchedEvents.push({
            ...ev,
            calendarName: cal.name,
          });
        }
      }
    }

    // 3. Filter schedule exceptions
    const matchedExceptions = (exceptions || []).filter((ex: ScheduleException) => {
      return (
        ex.date.includes(query) ||
        ex.exception_type.toLowerCase().includes(query) ||
        (ex.reason && ex.reason.toLowerCase().includes(query)) ||
        (ex.subject_name && ex.subject_name.toLowerCase().includes(query))
      );
    });

    return NextResponse.json({
      success: true,
      data: {
        classes: matchedClasses,
        events: matchedEvents,
        exceptions: matchedExceptions,
        query,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: (error as Error).message } },
      { status: 500 }
    );
  }
}
