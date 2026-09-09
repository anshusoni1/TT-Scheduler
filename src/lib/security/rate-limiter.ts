import { NextRequest } from 'next/server';
import { AppError } from '@/lib/errors';
import { ERROR_CODES } from '@/lib/constants/extraction';

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, ERROR_CODES.AI_RATE_LIMIT, 429);
  }
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface TokenBucket {
  count: number;
  resetAt: number;
}

// In-memory store. 
// SECURITY NOTE: In serverless environments (like Vercel), this state is per-lambda instance 
// and resets frequently. For true global rate limiting, a persistent store like Redis (Vercel KV) 
// MUST be provisioned. This is currently tracked as an accepted residual risk for Phase 1.
const store = new Map<string, TokenBucket>();
export class RateLimiter {
  /**
   * Applies rate limiting based on a client identifier.
   */
  static async checkLimit(
    identifier: string,
    action: string,
    config: RateLimitConfig
  ): Promise<void> {
    const key = `${action}:${identifier}`;
    const now = Date.now();
    
    const bucket = store.get(key) || { count: 0, resetAt: now + config.windowMs };

    // Reset bucket if window passed
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + config.windowMs;
    }

    bucket.count += 1;
    store.set(key, bucket);

    if (bucket.count > config.maxRequests) {
      throw new RateLimitError();
    }
  }

  /**
   * Extracts a client IP or fallback identifier from the request.
   */
  static getClientIdentifier(request: NextRequest): string {
    // Vercel populates x-forwarded-for
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    
    // In NextRequest (App Router), you can get IP from request.headers if running on edge,
    // or via request.ip if it's exposed (but TS says it's not on NextRequest in this Next version)
    // fallback to a default string if no proxy header exists
    return 'unknown-ip';
  }
}
