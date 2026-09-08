import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';
import { dateRegex } from '@/lib/validation';
import { getCurrentDateTimeInTimezone } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();

    const { searchParams } = new URL(request.url);
    const now = getCurrentDateTimeInTimezone();

    const from = searchParams.get('from') || now.dateString;
    const to = searchParams.get('to') || now.dateString;

    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw new ValidationError('Both "from" and "to" parameters must be in YYYY-MM-DD format.');
    }

    if (from > to) {
      throw new ValidationError('"from" date must be earlier than or equal to "to" date.');
    }

    // Limit range to 180 days max
    const startObj = new Date(`${from}T00:00:00Z`);
    const endObj = new Date(`${to}T00:00:00Z`);
    const daySpan = (endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24);

    if (daySpan > 180) {
      throw new ValidationError('Date range cannot exceed 180 days.');
    }

    const days = await SchedulingService.synthesizeScheduleForRange(
      supabase,
      user.id,
      from,
      to
    );

    return apiSuccess({ days });
  } catch (error) {
    return handleApiError(error);
  }
}
