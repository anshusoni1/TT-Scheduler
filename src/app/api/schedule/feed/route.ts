import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { CalendarFeedRepository } from '@/server/repositories/calendar-feed.repository';
import { apiSuccess, handleApiError } from '@/lib/errors';

function getFeedUrl(request: NextRequest, token: string): string {
  const origin = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${origin}/api/schedule/feed/${token}`;
}

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const repo = new CalendarFeedRepository(supabase);
    const feedToken = await repo.getActiveFeedToken(user.id);

    return apiSuccess({
      feedToken,
      feedUrl: feedToken ? getFeedUrl(request, feedToken.token) : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const repo = new CalendarFeedRepository(supabase);
    const feedToken = await repo.generateFeedToken(user.id);

    return apiSuccess({
      feedToken,
      feedUrl: getFeedUrl(request, feedToken.token),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const repo = new CalendarFeedRepository(supabase);
    await repo.revokeFeedToken(user.id);

    return apiSuccess({
      message: 'Calendar feed revoked successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
