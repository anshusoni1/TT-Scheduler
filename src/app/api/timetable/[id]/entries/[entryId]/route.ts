import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { updateTimetableEntrySchema } from '@/lib/validation';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string; entryId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id, entryId } = await params;
    const body = await request.json();

    const parseResult = updateTimetableEntrySchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors[0]?.message || 'Invalid entry update payload',
        parseResult.error.flatten()
      );
    }

    const repo = new TimetablesRepository(supabase);
    const updated = await repo.updateEntry(user.id, id, entryId, parseResult.data);

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id, entryId } = await params;
    const repo = new TimetablesRepository(supabase);

    await repo.deleteEntry(user.id, id, entryId);
    return apiSuccess({ deleted: true, entryId });
  } catch (error) {
    return handleApiError(error);
  }
}
