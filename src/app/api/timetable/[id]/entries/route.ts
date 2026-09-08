import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { timetableEntrySchema } from '@/lib/validation';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await params;
    const body = await request.json();

    const parseResult = timetableEntrySchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors[0]?.message || 'Invalid class slot input',
        parseResult.error.flatten()
      );
    }

    const repo = new TimetablesRepository(supabase);
    const newEntry = await repo.addEntry(user.id, id, parseResult.data);

    return apiSuccess(newEntry, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
