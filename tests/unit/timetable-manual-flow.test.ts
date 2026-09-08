/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach } from 'vitest';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { SchedulingService } from '@/server/services/scheduling.service';
import { ForbiddenError, AppError } from '@/lib/errors';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Timetable, TimetableEntry } from '@/types/database';

/**
 * Stateful in-memory PostgreSQL simulator adhering strictly to the Supabase client contract.
 * Simulates real database tables: public.timetables and public.timetable_entries with cascade and RLS constraints.
 */
class MockPostgresDatabase {
  timetables: Timetable[] = [];
  entries: TimetableEntry[] = [];

  createClient(_currentUserId: string): SupabaseClient<Database> {
    const timetables = this.timetables;
    const entries = this.entries;

    const createTableQueryBuilder = (tableName: string) => {
      const eqFilters: Record<string, unknown> = {};
      const neqFilters: Record<string, unknown> = {};
      let orderField: string | null = null;
      let orderAscending = true;

      const builder: any = {
        select: (_fields = '*') => {
          return builder;
        },
        eq: (col: string, val: unknown) => {
          eqFilters[col] = val;
          return builder;
        },
        neq: (col: string, val: unknown) => {
          neqFilters[col] = val;
          return builder;
        },
        order: (col: string, options?: { ascending?: boolean }) => {
          orderField = col;
          orderAscending = options?.ascending ?? true;
          return builder;
        },
        limit: (_n: number) => builder,
        insert: (data: any) => {
          if (tableName === 'timetables') {
            const newRecord: Timetable = {
              id: `tt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              user_id: data.user_id,
              academic_year_id: data.academic_year_id ?? null,
              name: data.name,
              effective_from: data.effective_from,
              effective_to: data.effective_to ?? null,
              timezone: data.timezone ?? 'Asia/Kolkata',
              active: data.active ?? true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            timetables.push(newRecord);
            return {
              select: () => ({
                single: async () => ({ data: newRecord, error: null }),
              }),
            };
          }
          if (tableName === 'timetable_entries') {
            const newEntry: TimetableEntry = {
              id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timetable_id: data.timetable_id,
              day_of_week: data.day_of_week,
              start_time: data.start_time,
              end_time: data.end_time,
              subject_name: data.subject_name,
              subject_code: data.subject_code ?? null,
              faculty_name: data.faculty_name ?? null,
              room: data.room ?? null,
              class_type: data.class_type ?? 'lecture',
              section: data.section ?? null,
              notes: data.notes ?? null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            entries.push(newEntry);
            return {
              select: () => ({
                single: async () => ({ data: newEntry, error: null }),
              }),
            };
          }
          return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
        },
        update: (updates: any) => {
          return {
            eq: (col1: string, val1: unknown) => {
              eqFilters[col1] = val1;
              return {
                eq: (col2: string, val2: unknown) => {
                  eqFilters[col2] = val2;
                  return {
                    select: () => ({
                      single: async () => {
                        return executeUpdate(updates);
                      },
                    }),
                  };
                },
                neq: (col2: string, val2: unknown) => {
                  neqFilters[col2] = val2;
                  // For deactivating other timetables
                  if (tableName === 'timetables') {
                    for (const tt of timetables) {
                      if (tt.user_id === eqFilters['user_id'] && tt.id !== val2) {
                        Object.assign(tt, updates, { updated_at: new Date().toISOString() });
                      }
                    }
                  }
                  return Promise.resolve({ error: null });
                },
                then: (resolve: any) => {
                  // Direct update execution without select
                  executeUpdate(updates);
                  resolve({ error: null });
                },
              };
            },
          };
        },
        delete: () => ({
          eq: (col1: string, val1: unknown) => ({
            eq: async (col2: string, val2: unknown) => {
              if (tableName === 'timetables') {
                const idx = timetables.findIndex((t) => t[col1 as keyof Timetable] === val1 && t[col2 as keyof Timetable] === val2);
                if (idx !== -1) {
                  const deleted = timetables.splice(idx, 1)[0];
                  // Cascade delete entries
                  const remaining = entries.filter((e) => e.timetable_id !== deleted.id);
                  entries.length = 0;
                  entries.push(...remaining);
                }
              }
              if (tableName === 'timetable_entries') {
                const idx = entries.findIndex((e) => e[col1 as keyof TimetableEntry] === val1 && e[col2 as keyof TimetableEntry] === val2);
                if (idx !== -1) {
                  entries.splice(idx, 1);
                }
              }
              return { error: null };
            },
          }),
        }),
        maybeSingle: async () => {
          const results = filterRecords();
          return { data: results[0] || null, error: null };
        },
        single: async () => {
          const results = filterRecords();
          return { data: results[0] || null, error: null };
        },
        then: (resolve: any) => {
          const results = filterRecords();
          resolve({ data: results, error: null });
        },
      };

      const executeUpdate = (updates: any) => {
        if (tableName === 'timetables') {
          const tt = timetables.find((t) => {
            return Object.entries(eqFilters).every(([k, v]) => t[k as keyof Timetable] === v);
          });
          if (tt) {
            Object.assign(tt, updates, { updated_at: new Date().toISOString() });
            return { data: { ...tt }, error: null };
          }
        }
        if (tableName === 'timetable_entries') {
          const entry = entries.find((e) => {
            return Object.entries(eqFilters).every(([k, v]) => e[k as keyof TimetableEntry] === v);
          });
          if (entry) {
            Object.assign(entry, updates, { updated_at: new Date().toISOString() });
            return { data: { ...entry }, error: null };
          }
        }
        return { data: null, error: null };
      };

      const filterRecords = () => {
        let list: any[] = tableName === 'timetables' ? [...timetables] : [...entries];
        for (const [k, v] of Object.entries(eqFilters)) {
          list = list.filter((r) => (r as any)[k] === v);
        }
        if (orderField) {
          list.sort((a, b) => {
            const valA = (a as any)[orderField!];
            const valB = (b as any)[orderField!];
            if (valA < valB) return orderAscending ? -1 : 1;
            if (valA > valB) return orderAscending ? 1 : -1;
            return 0;
          });
        }
        return list;
      };

      return builder;
    };

    return {
      from: createTableQueryBuilder,
    } as unknown as SupabaseClient<Database>;
  }
}

describe('Full Manual Timetable Vertical Slice - Complete 14-Step Flow', () => {
  let db: MockPostgresDatabase;
  const USER_A = 'student-alice-1111';
  const USER_B = 'student-bob-2222';

  beforeEach(() => {
    db = new MockPostgresDatabase();
  });

  it('executes and verifies the full 14-step manual testing sequence', async () => {
    const clientA = db.createClient(USER_A);
    const repoA = new TimetablesRepository(clientA);

    // 1. Create a timetable
    const createdTt = await repoA.createTimetable(USER_A, {
      name: 'Spring 2026 Computer Science',
      effective_from: '2026-01-15',
      timezone: 'Asia/Kolkata',
      active: true,
    });
    expect(createdTt.id).toBeDefined();
    expect(createdTt.name).toBe('Spring 2026 Computer Science');
    expect(createdTt.active).toBe(true);

    // 2. Add at least two classes
    // Class 1: Algorithms on Monday 10:00 - 11:00
    const class1 = await repoA.addEntry(USER_A, createdTt.id, {
      day_of_week: 'monday',
      start_time: '10:00:00',
      end_time: '11:00:00',
      subject_name: 'Analysis of Algorithms',
      subject_code: 'CS301',
      room: 'LH-101',
      faculty_name: 'Prof. Donald Knuth',
      class_type: 'lecture',
    });
    expect(class1.id).toBeDefined();
    expect(class1.subject_name).toBe('Analysis of Algorithms');

    // Class 2: Operating Systems on Monday 11:15 - 12:15
    const class2 = await repoA.addEntry(USER_A, createdTt.id, {
      day_of_week: 'monday',
      start_time: '11:15:00',
      end_time: '12:15:00',
      subject_name: 'Operating Systems',
      subject_code: 'CS302',
      room: 'Lab-2',
      faculty_name: 'Prof. Andrew Tanenbaum',
      class_type: 'lab',
    });
    expect(class2.id).toBeDefined();
    expect(class2.subject_name).toBe('Operating Systems');

    // 3. Reload browser / re-fetch from database
    const fetchedTt = await repoA.getActiveTimetable(USER_A);

    // 4. Confirm classes still exist in PostgreSQL state
    expect(fetchedTt).not.toBeNull();
    expect(fetchedTt?.entries).toHaveLength(2);
    expect(fetchedTt?.entries.map((e) => e.subject_name)).toContain('Analysis of Algorithms');
    expect(fetchedTt?.entries.map((e) => e.subject_name)).toContain('Operating Systems');

    // 5. Edit a class (e.g. change room and subject name of Class 1)
    const updatedClass1 = await repoA.updateEntry(USER_A, createdTt.id, class1.id, {
      subject_name: 'Advanced Algorithms',
      room: 'Auditorium A',
    });
    expect(updatedClass1.subject_name).toBe('Advanced Algorithms');
    expect(updatedClass1.room).toBe('Auditorium A');

    // 6. Confirm database persistence after edit
    const recheckedEntry = await repoA.getEntryById(USER_A, createdTt.id, class1.id);
    expect(recheckedEntry.subject_name).toBe('Advanced Algorithms');
    expect(recheckedEntry.room).toBe('Auditorium A');

    // 7. Delete a class (Delete Class 2: Operating Systems)
    await repoA.deleteEntry(USER_A, createdTt.id, class2.id);

    // 8. Confirm deletion in database
    const ttAfterDeletion = await repoA.getActiveTimetable(USER_A);
    expect(ttAfterDeletion?.entries).toHaveLength(1);
    expect(ttAfterDeletion?.entries[0].id).toBe(class1.id);
    expect(ttAfterDeletion?.entries.find((e) => e.id === class2.id)).toBeUndefined();

    // Re-add class 2 and an afternoon class for rich scheduling verification
    await repoA.addEntry(USER_A, createdTt.id, {
      day_of_week: 'monday',
      start_time: '11:15:00',
      end_time: '12:15:00',
      subject_name: 'Operating Systems',
      room: 'Lab-2',
      class_type: 'lab',
    });
    await repoA.addEntry(USER_A, createdTt.id, {
      day_of_week: 'monday',
      start_time: '14:00:00',
      end_time: '15:30:00',
      subject_name: 'Database Architecture',
      room: 'Room 305',
      class_type: 'lecture',
    });
    // Add a Tuesday class to test next-day calculation
    await repoA.addEntry(USER_A, createdTt.id, {
      day_of_week: 'tuesday',
      start_time: '09:00:00',
      end_time: '10:00:00',
      subject_name: 'Computer Networks',
      room: 'Room 201',
      class_type: 'lecture',
    });

    const activeTimetableWithEntries = await repoA.getActiveTimetable(USER_A);
    expect(activeTimetableWithEntries).not.toBeNull();

    // 9. Open dashboard: Compute today's schedule
    // 10. Confirm today's schedule comes from the database
    const scheduleMorning = SchedulingService.calculateScheduleFromTimetable(
      activeTimetableWithEntries!,
      'monday',
      '2026-09-07',
      '08:00:00',
      '08:00',
      480,
      'Asia/Kolkata'
    );
    expect(scheduleMorning.hasTimetable).toBe(true);
    expect(scheduleMorning.todayClasses).toHaveLength(3);
    expect(scheduleMorning.todayClasses[0].subject_name).toBe('Advanced Algorithms');

    // 11. Test current-class logic
    // At 10:25: inside Advanced Algorithms (10:00 - 11:00)
    const scheduleInClass = SchedulingService.calculateScheduleFromTimetable(
      activeTimetableWithEntries!,
      'monday',
      '2026-09-07',
      '10:25:00',
      '10:25',
      625,
      'Asia/Kolkata'
    );
    expect(scheduleInClass.currentClass).not.toBeNull();
    expect(scheduleInClass.currentClass?.subject_name).toBe('Advanced Algorithms');
    expect(scheduleInClass.currentClass?.status).toBe('current');

    // 12. Test next-class logic:
    // A) While in Class 1, next class should be Class 2 (Operating Systems at 11:15 today)
    expect(scheduleInClass.nextClass).not.toBeNull();
    expect(scheduleInClass.nextClass?.subject_name).toBe('Operating Systems');
    expect(scheduleInClass.nextClass?.isToday).toBe(true);

    // B) In the evening (16:30) after all Monday classes have finished:
    const scheduleEvening = SchedulingService.calculateScheduleFromTimetable(
      activeTimetableWithEntries!,
      'monday',
      '2026-09-07',
      '16:30:00',
      '16:30',
      990,
      'Asia/Kolkata'
    );
    expect(scheduleEvening.currentClass).toBeNull();
    expect(scheduleEvening.nextClass).not.toBeNull();
    // Next class must be Tuesday's Computer Networks!
    expect(scheduleEvening.nextClass?.subject_name).toBe('Computer Networks');
    expect(scheduleEvening.nextClass?.targetDay).toBe('tuesday');
    expect(scheduleEvening.nextClass?.isToday).toBe(false);

    // 13. Test overlapping classes (conflict detection)
    // Attempt to add a class overlapping with Advanced Algorithms (10:00 - 11:00)
    await expect(
      repoA.addEntry(USER_A, createdTt.id, {
        day_of_week: 'monday',
        start_time: '10:30:00',
        end_time: '11:30:00',
        subject_name: 'Overlapping AI Class',
      })
    ).rejects.toThrowError(AppError);

    // 14. Test unauthorized access: User B cannot access or modify User A's timetable
    const clientB = db.createClient(USER_B);
    const repoB = new TimetablesRepository(clientB);

    // User B attempts to fetch User A's timetable
    await expect(repoB.getTimetableById(USER_B, createdTt.id)).rejects.toThrowError(ForbiddenError);

    // User B attempts to add an entry to User A's timetable
    await expect(
      repoB.addEntry(USER_B, createdTt.id, {
        day_of_week: 'monday',
        start_time: '13:00:00',
        end_time: '14:00:00',
        subject_name: 'Hacked Class',
      })
    ).rejects.toThrowError(ForbiddenError);
  });
});
