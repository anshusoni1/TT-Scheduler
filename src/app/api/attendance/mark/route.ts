import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { AttendanceService } from '@/server/services/attendance.service';
import { markAttendanceSchema } from '@/lib/validation';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const body = await request.json();
    const parseResult = markAttendanceSchema.safeParse(body);

    if (!parseResult.success) {
      throw new ValidationError(
        parseResult.error.errors[0]?.message || 'Invalid attendance payload.',
        parseResult.error.flatten().fieldErrors
      );
    }

    const record = await AttendanceService.markAttendance(
      supabase,
      user.id,
      parseResult.data
    );

    return apiSuccess({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
