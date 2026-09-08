import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { updateCalendarEventSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id, eventId } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    const event = await calendarsRepo.getEventById(user.id, id, eventId);

    return NextResponse.json({
      success: true,
      data: { event },
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

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id, eventId } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parsed = updateCalendarEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid calendar event update payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const calendarsRepo = new CalendarsRepository(supabase);
    const updated = await calendarsRepo.updateEvent(user.id, id, eventId, {
      event_date: parsed.data.event_date,
      event_type: parsed.data.event_type,
      title: parsed.data.title,
      description: parsed.data.description,
      is_teaching_day: parsed.data.is_teaching_day,
      is_holiday: parsed.data.is_holiday,
      affects_regular_schedule: parsed.data.affects_regular_schedule,
      metadata: parsed.data.metadata as Record<string, unknown> | undefined,
    });

    return NextResponse.json({
      success: true,
      data: { event: updated },
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

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; eventId: string }> }
) {
  try {
    const { id, eventId } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    await calendarsRepo.deleteEvent(user.id, id, eventId);

    return NextResponse.json({
      success: true,
      data: { deleted: true },
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
