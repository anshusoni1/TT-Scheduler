import { AuthService } from '@/server/services/auth.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { apiSuccess, handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const schedule = await SchedulingService.getTodaySchedule(supabase, user.id);

    return apiSuccess(schedule);
  } catch (error) {
    return handleApiError(error);
  }
}
