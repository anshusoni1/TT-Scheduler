import { describe, it, expect, vi } from 'vitest';
import { CalendarFeedRepository } from '@/server/repositories/calendar-feed.repository';
import type { CalendarFeedToken, TypedSupabaseClient } from '@/types/database';

describe('CalendarFeedRepository (Tokenized Subscription Feed)', () => {
  const USER_ID = 'feed-user-1111-1111-1111';

  it('generates a secure 48-character hex token and sets active=true', async () => {
    let insertedToken: Partial<CalendarFeedToken> | null = null;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'calendar_feed_tokens') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((payload: Partial<CalendarFeedToken>) => {
              insertedToken = {
                id: 'token-id-123',
                ...payload,
                created_at: new Date().toISOString(),
                revoked_at: null,
              };
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: insertedToken,
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as TypedSupabaseClient;

    const repo = new CalendarFeedRepository(mockSupabase);
    const result = await repo.generateFeedToken(USER_ID);

    expect(result).toBeDefined();
    expect(result.token).toHaveLength(48); // 24 bytes in hex = 48 chars
    expect(result.active).toBe(true);
    expect(result.user_id).toBe(USER_ID);
  });

  it('revokes any existing active tokens when generating a new token', async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const mockSupabase = {
      from: vi.fn(() => ({
        update: updateSpy,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-id', token: 'new-token', active: true, user_id: USER_ID },
              error: null,
            }),
          }),
        }),
      })),
    } as unknown as TypedSupabaseClient;

    const repo = new CalendarFeedRepository(mockSupabase);
    await repo.generateFeedToken(USER_ID);

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ active: false })
    );
  });

  it('finds an active token by its hex string and returns null if not found or revoked', async () => {
    const activeRecord: CalendarFeedToken = {
      id: 'tok-1',
      user_id: USER_ID,
      token: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      active: true,
      created_at: '2026-09-01T00:00:00Z',
      revoked_at: null,
    };

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn((field: string, val: unknown) => {
            if (field === 'token' && val === activeRecord.token) {
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: activeRecord, error: null }),
                }),
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            };
          }),
        }),
      })),
    } as unknown as TypedSupabaseClient;

    const repo = new CalendarFeedRepository(mockSupabase);
    const found = await repo.findActiveToken(activeRecord.token);
    expect(found).toEqual(activeRecord);

    const missing = await repo.findActiveToken('non-existent-token');
    expect(missing).toBeNull();
  });
});
