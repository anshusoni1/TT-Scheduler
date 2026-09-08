import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { AttendanceService } from '@/server/services/attendance.service';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const { searchParams } = new URL(request.url);
    const targetStr = searchParams.get('target');
    let target: number | undefined;

    if (targetStr) {
      const parsed = parseFloat(targetStr);
      if (isNaN(parsed) || parsed <= 0 || parsed > 100) {
        throw new ValidationError('Target attendance must be a percentage between 1 and 100.');
      }
      target = parsed;
    }

    const overview = await AttendanceService.getAttendanceOverview(
      supabase,
      user.id,
      target
    );

    return apiSuccess({ overview });
  } catch (error) {
    return handleApiError(error);
  }
}
