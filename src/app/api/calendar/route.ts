import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { academicCalendarSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    const [activeCalendar, allCalendars] = await Promise.all([
      calendarsRepo.getActiveCalendar(user.id),
      calendarsRepo.getUserCalendars(user.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeCalendar,
        calendars: allCalendars,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message, details: error.details } },
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

export async function POST(request: Request) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parsed = academicCalendarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid academic calendar payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const calendarsRepo = new CalendarsRepository(supabase);
    const calendar = await calendarsRepo.createCalendar(
      user.id,
      {
        name: parsed.data.name,
        effective_from: parsed.data.effective_from,
        effective_to: parsed.data.effective_to,
        academic_year_id: parsed.data.academic_year_id,
        active: parsed.data.active,
      },
      parsed.data.events || []
    );

    return NextResponse.json(
      { success: true, data: { calendar } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message, details: error.details } },
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
