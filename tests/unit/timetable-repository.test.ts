import { describe, it, expect, vi } from 'vitest';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { AppError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

describe('TimetablesRepository - Conflict Detection & Entry CRUD', () => {
  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const TIMETABLE_ID = '22222222-2222-2222-2222-222222222222';
  const ENTRY_ID = '33333333-3333-3333-3333-333333333333';

  describe('checkTimeConflict', () => {
    it('detects overlapping entries on the same weekday', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'existing-1',
                    timetable_id: TIMETABLE_ID,
                    day_of_week: 'monday',
                    start_time: '10:00:00',
                    end_time: '11:00:00',
                    subject_name: 'Existing Physics',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      // Attempting to add 10:30 to 11:30 should conflict
      const conflict = await repo.checkTimeConflict(
        TIMETABLE_ID,
        'monday',
        '10:30',
        '11:30'
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictingEntry?.subject_name).toBe('Existing Physics');
    });

    it('allows non-overlapping entries on the same weekday', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'existing-1',
                    timetable_id: TIMETABLE_ID,
                    day_of_week: 'monday',
                    start_time: '10:00:00',
                    end_time: '11:00:00',
                    subject_name: 'Physics',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      // 11:00 to 12:00 touches boundary but does not overlap
      const conflict = await repo.checkTimeConflict(
        TIMETABLE_ID,
        'monday',
        '11:00',
        '12:00'
      );

      expect(conflict.hasConflict).toBe(false);
      expect(conflict.conflictingEntry).toBeUndefined();
    });

    it('ignores the entry being updated when excludeEntryId is passed', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: ENTRY_ID,
                    timetable_id: TIMETABLE_ID,
                    day_of_week: 'monday',
                    start_time: '10:00:00',
                    end_time: '11:00:00',
                    subject_name: 'Current Entry',
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      // Editing the same entry with slightly adjusted attributes should exclude itself
      const conflict = await repo.checkTimeConflict(
        TIMETABLE_ID,
        'monday',
        '10:00',
        '11:00',
        ENTRY_ID
      );

      expect(conflict.hasConflict).toBe(false);
    });
  });

  describe('createTimetable with batch entries', () => {
    it('throws AppError with 409 conflict when batch contains overlapping entries on same day', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TIMETABLE_ID, user_id: USER_ID },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      await expect(
        repo.createTimetable(
          USER_ID,
          {
            name: 'Conflicting Batch',
            effective_from: '2026-08-01',
          },
          [
            {
              day_of_week: 'tuesday',
              start_time: '09:00',
              end_time: '10:30',
              subject_name: 'Class A',
            },
            {
              day_of_week: 'tuesday',
              start_time: '10:00',
              end_time: '11:00',
              subject_name: 'Class B',
            },
          ]
        )
      ).rejects.toThrowError(/Batch conflict/);
    });
  });

  describe('addEntry conflict handling', () => {
    it('throws AppError with 409 status code when adding an overlapping class slot', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'timetables') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: TIMETABLE_ID, user_id: USER_ID },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'timetable_entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'existing-entry',
                        timetable_id: TIMETABLE_ID,
                        day_of_week: 'wednesday',
                        start_time: '14:00:00',
                        end_time: '15:30:00',
                        subject_name: 'Thermodynamics',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      try {
        await repo.addEntry(USER_ID, TIMETABLE_ID, {
          day_of_week: 'wednesday',
          start_time: '14:30',
          end_time: '16:00',
          subject_name: 'Fluid Mechanics',
        });
        expect.fail('Should have thrown AppError for conflict');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(409);
        expect(appErr.code).toBe('CONFLICT');
        expect(appErr.message).toContain('Time conflict');
        expect(appErr.message).toContain('Thermodynamics');
      }
    });
  });
});
