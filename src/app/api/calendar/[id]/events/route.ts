import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { calendarEventSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify calendar ownership first
    const calendar = await calendarsRepo.getCalendarById(user.id, id);

    let events = calendar.events;
    if (startDate && endDate) {
      events = events.filter((e) => e.event_date >= startDate && e.event_date <= endDate);
    }

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parsed = calendarEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid calendar event payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const calendarsRepo = new CalendarsRepository(supabase);
    const event = await calendarsRepo.addEvent(user.id, id, {
      event_date: parsed.data.event_date,
      event_type: parsed.data.event_type,
      title: parsed.data.title,
      description: parsed.data.description,
      is_teaching_day: parsed.data.is_teaching_day,
      is_holiday: parsed.data.is_holiday,
      affects_regular_schedule: parsed.data.affects_regular_schedule,
      metadata: parsed.data.metadata as Record<string, unknown>,
    });

    return NextResponse.json(
      { success: true, data: { event } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
