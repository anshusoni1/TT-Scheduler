import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { scheduleExceptionSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const exceptionsRepo = new ExceptionsRepository(supabase);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let exceptions;
    if (date) {
      exceptions = await exceptionsRepo.getExceptionsForDate(user.id, date);
    } else if (startDate && endDate) {
      exceptions = await exceptionsRepo.getExceptionsForRange(user.id, startDate, endDate);
    } else {
      exceptions = await exceptionsRepo.getUserExceptions(user.id);
    }

    return NextResponse.json({
      success: true,
      data: { exceptions },
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

export async function POST(request: Request) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parsed = scheduleExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid schedule exception payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const exceptionsRepo = new ExceptionsRepository(supabase);
    const exception = await exceptionsRepo.createException(user.id, {
      date: parsed.data.date,
      exception_type: parsed.data.exception_type,
      original_timetable_entry_id: parsed.data.original_timetable_entry_id,
      subject_name: parsed.data.subject_name,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      room: parsed.data.room,
      reason: parsed.data.reason,
    });

    return NextResponse.json(
      { success: true, data: { exception } },
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
