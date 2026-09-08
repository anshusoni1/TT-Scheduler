import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { updateAcademicCalendarSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    const calendar = await calendarsRepo.getCalendarById(user.id, id);

    return NextResponse.json({
      success: true,
      data: { calendar },
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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parsed = updateAcademicCalendarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const calendarsRepo = new CalendarsRepository(supabase);
    // Verify ownership first
    await calendarsRepo.getCalendarById(user.id, id);

    const updated = await calendarsRepo.updateCalendar(user.id, id, parsed.data);

    return NextResponse.json({
      success: true,
      data: { calendar: updated },
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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const calendarsRepo = new CalendarsRepository(supabase);

    // Verify ownership first
    await calendarsRepo.getCalendarById(user.id, id);
    await calendarsRepo.deleteCalendar(user.id, id);

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
