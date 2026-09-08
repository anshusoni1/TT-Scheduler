import { NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { updateScheduleExceptionSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { user, supabase } = await AuthService.requireUser();
    const exceptionsRepo = new ExceptionsRepository(supabase);

    const exception = await exceptionsRepo.getExceptionById(user.id, id);

    return NextResponse.json({
      success: true,
      data: { exception },
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

    const parsed = updateScheduleExceptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid schedule exception update payload',
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const exceptionsRepo = new ExceptionsRepository(supabase);
    const updated = await exceptionsRepo.updateException(user.id, id, parsed.data);

    return NextResponse.json({
      success: true,
      data: { exception: updated },
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
    const exceptionsRepo = new ExceptionsRepository(supabase);

    await exceptionsRepo.deleteException(user.id, id);

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
