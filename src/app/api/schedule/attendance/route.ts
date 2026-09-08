import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const { searchParams } = new URL(request.url);
    const targetStr = searchParams.get('target');
    let target = 75;

    if (targetStr) {
      const parsed = parseFloat(targetStr);
      if (isNaN(parsed) || parsed <= 0 || parsed > 100) {
        throw new ValidationError('Target attendance must be a percentage between 1 and 100.');
      }
      target = parsed;
    }

    const analytics = await SchedulingService.calculateAttendanceAnalytics(
      supabase,
      user.id,
      target
    );

    return apiSuccess(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
