import { createClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/lib/errors';
import type { User } from '@supabase/supabase-js';

export class AuthService {
  /**
   * Retrieves the authenticated user from the request session.
   * Uses supabase.auth.getUser() to cryptographically validate the JWT.
   * Throws UnauthorizedError if no authenticated session exists.
   */
  static async requireUser(): Promise<{ user: User; supabase: Awaited<ReturnType<typeof createClient>> }> {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new UnauthorizedError('Authentication required. Please sign in.');
    }

    return { user, supabase };
  }

  /**
   * Returns user if authenticated, or null if unauthenticated. Does not throw.
   */
  static async getOptionalUser(): Promise<{ user: User | null; supabase: Awaited<ReturnType<typeof createClient>> }> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { user, supabase };
  }
}
