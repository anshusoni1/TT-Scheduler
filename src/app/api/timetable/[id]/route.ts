import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';
import { z } from 'zod';

const updateTimetableSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  timezone: z.string().trim().optional(),
  active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await params;
    const repo = new TimetablesRepository(supabase);

    const timetable = await repo.getTimetableById(user.id, id);
    return apiSuccess(timetable);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await params;
    const body = await request.json();

    const parseResult = updateTimetableSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors[0]?.message || 'Invalid update payload',
        parseResult.error.flatten()
      );
    }

    const repo = new TimetablesRepository(supabase);
    const updated = await repo.updateTimetable(user.id, id, parseResult.data);

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await params;
    const repo = new TimetablesRepository(supabase);

    await repo.deleteTimetable(user.id, id);
    return apiSuccess({ deleted: true, id });
  } catch (error) {
    return handleApiError(error);
  }
}
