import crypto from 'node:crypto';
import type { CalendarFeedToken, TypedSupabaseClient } from '@/types/database';
import { AppError } from '@/lib/errors';

export class CalendarFeedRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Retrieves the currently active calendar feed token for a user.
   */
  async getActiveFeedToken(userId: string): Promise<CalendarFeedToken | null> {
    const { data, error } = await this.supabase
      .from('calendar_feed_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch calendar feed token: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || null;
  }

  /**
   * Generates a cryptographically secure token and revokes any prior active tokens.
   */
  async generateFeedToken(userId: string): Promise<CalendarFeedToken> {
    // Revoke any prior active tokens for this user
    await this.revokeFeedToken(userId);

    const secureToken = crypto.randomBytes(24).toString('hex');

    const { data, error } = await this.supabase
      .from('calendar_feed_tokens')
      .insert({
        user_id: userId,
        token: secureToken,
        active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to create calendar feed token: ${error?.message || 'Insert failed'}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  /**
   * Revokes all active feed tokens for a user.
   */
  async revokeFeedToken(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_feed_tokens')
      .update({
        active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('active', true);

    if (error) {
      throw new AppError(`Failed to revoke calendar feed token: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }

  /**
   * Looks up a valid active feed token by its public secret string.
   */
  async findActiveToken(token: string): Promise<CalendarFeedToken | null> {
    const { data, error } = await this.supabase
      .from('calendar_feed_tokens')
      .select('*')
      .eq('token', token)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to look up feed token: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || null;
  }
}
