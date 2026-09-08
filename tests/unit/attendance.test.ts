import { describe, it, expect, vi } from 'vitest';
import { AttendanceService } from '@/server/services/attendance.service';
import { AttendanceRepository } from '@/server/repositories/attendance.repository';
import type {
  AttendanceRecord,
  TypedSupabaseClient,
  AcademicCalendar,
} from '@/types/database';

describe('Attendance System (Phases 11–17)', () => {
  const USER_ID = 'attend-user-1111-1111-1111';

  describe('AttendanceRepository', () => {
    it('upserts attendance record with unique occurrence context', async () => {
      let upsertedPayload: Partial<AttendanceRecord> | null = null;

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'attendance_records') {
            return {
              upsert: vi.fn().mockImplementation((payload: Partial<AttendanceRecord>) => {
                upsertedPayload = {
                  id: 'rec-1',
                  ...payload,
                  created_at: new Date().toISOString(),
                };
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: upsertedPayload,
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

      const repo = new AttendanceRepository(mockSupabase);
      const result = await repo.setAttendance(USER_ID, {
        date: '2026-09-10',
        timetable_entry_id: 'tt-entry-1',
        occurrence_context: 'regular',
        status: 'present',
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe('present');
      expect(result?.date).toBe('2026-09-10');
      expect(result?.timetable_entry_id).toBe('tt-entry-1');
    });

    it('deletes attendance record when status is reset to not_marked', async () => {
      const deleteQuery = {
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: (arg: { error: null }) => void) => resolve({ error: null }),
      };

      const mockSupabase = {
        from: vi.fn(() => ({
          delete: vi.fn(() => deleteQuery),
        })),
      } as unknown as TypedSupabaseClient;

      const repo = new AttendanceRepository(mockSupabase);
      const result = await repo.setAttendance(USER_ID, {
        date: '2026-09-10',
        timetable_entry_id: 'tt-entry-1',
        status: 'not_marked',
      });

      expect(result).toBeNull();
      expect(deleteQuery.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });
  });

  describe('AttendanceService Domain Invariants', () => {
    const mockCalendar: AcademicCalendar = {
      id: 'cal-attend',
      user_id: USER_ID,
      academic_year_id: null,
      name: 'Autumn 2026',
      effective_from: '2026-09-01',
      effective_to: '2026-12-31',
      active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    };

    it('rejects marking attendance on an official academic holiday', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'academic_calendars') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: mockCalendar,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'calendar_events') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'ev-hol',
                        calendar_id: 'cal-attend',
                        event_date: '2026-10-02',
                        event_type: 'holiday',
                        is_holiday: true,
                        is_teaching_day: false,
                        affects_regular_schedule: true,
                        title: 'Gandhi Jayanti',
                        description: null,
                        metadata: {},
                        created_at: '2026-09-01T00:00:00Z',
                        updated_at: '2026-09-01T00:00:00Z',
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
      } as unknown as TypedSupabaseClient;

      await expect(
        AttendanceService.markAttendance(mockSupabase, USER_ID, {
          date: '2026-10-02',
          timetable_entry_id: 'slot-1',
          status: 'present',
        })
      ).rejects.toThrow('Cannot mark attendance on an official academic holiday');
    });

    it('rejects marking attendance for a class session that has been cancelled via schedule exception', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'academic_calendars') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'schedule_exceptions') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'ex-canc',
                        user_id: USER_ID,
                        date: '2026-09-15',
                        exception_type: 'cancelled',
                        original_timetable_entry_id: 'slot-cancelled',
                        subject_name: 'Compiler Design',
                        start_time: '10:00:00',
                        end_time: '11:00:00',
                        room: null,
                        reason: 'Professor on leave',
                        created_at: '2026-09-01T00:00:00Z',
                        updated_at: '2026-09-01T00:00:00Z',
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
      } as unknown as TypedSupabaseClient;

      await expect(
        AttendanceService.markAttendance(mockSupabase, USER_ID, {
          date: '2026-09-15',
          timetable_entry_id: 'slot-cancelled',
          status: 'present',
        })
      ).rejects.toThrow('Cannot mark attendance for a class session that has been cancelled');
    });
  });
});
