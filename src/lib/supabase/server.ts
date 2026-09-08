import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { fetchWithRetry } from '@/lib/network';

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.');
  }

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: {
      fetch: fetchWithRetry as typeof globalThis.fetch,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Creates a Supabase Admin Client using the SERVICE_ROLE key.
 * CAUTION: This client bypasses Row Level Security (RLS).
 * MUST only be used for background jobs, webhooks, or administrative routines.
 * NEVER expose this or call this directly on behalf of an unverified client!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY for admin client.');
  }

  return createSupabaseClient<Database>(supabaseUrl, secretKey, {
    global: {
      fetch: fetchWithRetry as typeof globalThis.fetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
