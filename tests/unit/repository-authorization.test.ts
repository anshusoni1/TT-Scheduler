import { describe, it, expect, vi } from 'vitest';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

describe('Repository Multi-Tenant Authorization & Isolation', () => {
  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';
  const RESOURCE_ID = '33333333-3333-3333-3333-333333333333';

  describe('TimetablesRepository Isolation', () => {
    it('throws ForbiddenError when User B attempts to access User A timetable', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: RESOURCE_ID,
                  user_id: USER_A_ID, // Owned by User A
                  name: "User A Timetable",
                  effective_from: '2026-08-01',
                  effective_to: null,
                  timezone: 'Asia/Kolkata',
                  active: true,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);

      // User B attempts to get User A's timetable
      await expect(repo.getTimetableById(USER_B_ID, RESOURCE_ID)).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError if timetable does not exist', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new TimetablesRepository(mockSupabase);
      await expect(repo.getTimetableById(USER_A_ID, RESOURCE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('CalendarsRepository Isolation', () => {
    it('throws ForbiddenError when User B attempts to access User A calendar', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: RESOURCE_ID,
                  user_id: USER_A_ID, // Owned by User A
                  name: "User A Calendar",
                  effective_from: '2026-08-01',
                  effective_to: null,
                  active: true,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new CalendarsRepository(mockSupabase);

      // User B attempts to get User A's calendar
      await expect(repo.getCalendarById(USER_B_ID, RESOURCE_ID)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('DocumentsRepository Isolation', () => {
    it('throws ForbiddenError when User B attempts to access User A document', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: RESOURCE_ID,
                  user_id: USER_A_ID, // Owned by User A
                  file_name: 'private_timetable.pdf',
                  storage_path: 'user_a/private_timetable.pdf',
                  mime_type: 'application/pdf',
                  file_size: 1024,
                  processing_status: 'completed',
                  processing_version: 1,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);

      // User B attempts to fetch User A's document
      await expect(repo.getDocumentById(USER_B_ID, RESOURCE_ID)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('AcademicYearsRepository Isolation', () => {
    it('queries strictly with user_id to prevent tenant leakage', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      } as unknown as SupabaseClient<Database>;

      const { AcademicYearsRepository } = await import('@/server/repositories/academic-years.repository');
      const repo = new AcademicYearsRepository(mockSupabase);

      await repo.getAcademicYears(USER_A_ID);
      expect(mockSupabase.from).toHaveBeenCalledWith('academic_years');
      expect(mockSelect().eq).toHaveBeenCalledWith('user_id', USER_A_ID);
    });
  });

  describe('ExceptionsRepository Isolation', () => {
    it('queries exceptions strictly bound to the requesting user_id', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: mockSelect,
        }),
      } as unknown as SupabaseClient<Database>;

      const { ExceptionsRepository } = await import('@/server/repositories/exceptions.repository');
      const repo = new ExceptionsRepository(mockSupabase);

      await repo.getExceptionsForDate(USER_A_ID, '2026-09-08');
      expect(mockSupabase.from).toHaveBeenCalledWith('schedule_exceptions');
      expect(mockSelect().eq).toHaveBeenCalledWith('user_id', USER_A_ID);
    });
  });
});

