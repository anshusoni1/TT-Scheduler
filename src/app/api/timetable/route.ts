import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { timetableSchema } from '@/lib/validation';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

export async function GET() {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const repo = new TimetablesRepository(supabase);

    const [activeTimetable, timetables] = await Promise.all([
      repo.getActiveTimetable(user.id),
      repo.getUserTimetables(user.id),
    ]);

    return apiSuccess({
      activeTimetable,
      timetables,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const body = await request.json();

    const parseResult = timetableSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors[0]?.message || 'Invalid timetable input',
        parseResult.error.flatten()
      );
    }

    const { entries = [], ...timetableData } = parseResult.data;
    const repo = new TimetablesRepository(supabase);

    const created = await repo.createTimetable(user.id, timetableData, entries);

    return apiSuccess(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
