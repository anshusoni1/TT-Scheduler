import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { DocumentProcessingService } from '@/server/services/document-processing.service';
import { MockDocumentAIProvider } from '@/server/services/ai/mock-document-ai.provider';
import { setCustomAIProvider } from '@/server/services/ai/ai-provider.factory';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { ERROR_CODES } from '@/lib/constants/extraction';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

function createChainableMock(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data, error });
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

describe('Document Processing Pipeline, Human Review & Transactional Commit', () => {
  const USER_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const USER_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const DOC_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const JOB_ID = 'jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj';
  const TIMETABLE_ID = 'tttttttt-tttt-tttt-tttt-tttttttttttt';
  const CALENDAR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  let mockAI: MockDocumentAIProvider;

  beforeEach(() => {
    mockAI = new MockDocumentAIProvider();
    setCustomAIProvider(mockAI);
  });

  describe('Storage & Document Ingestion', () => {
    it('uploads file to private storage path under user directory', async () => {
      const uploadMock = vi.fn().mockResolvedValue({ data: { path: `${USER_A_ID}/${DOC_ID}/timetable.png` }, error: null });
      const mockSupabase = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: uploadMock,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);
      const storagePath = await repo.uploadFile(
        USER_A_ID,
        DOC_ID,
        Buffer.from('fake-image-data'),
        'timetable.png',
        'image/png'
      );

      expect(storagePath).toBe(`${USER_A_ID}/${DOC_ID}/timetable.png`);
      expect(uploadMock).toHaveBeenCalledWith(
        `${USER_A_ID}/${DOC_ID}/timetable.png`,
        expect.any(Buffer),
        expect.objectContaining({
          contentType: 'image/png',
          upsert: true,
        })
      );
    });

    it('creates document record in uploaded state', async () => {
      const mockDoc = {
        id: DOC_ID,
        user_id: USER_A_ID,
        document_type: 'timetable',
        file_name: 'schedule.png',
        storage_path: `${USER_A_ID}/${DOC_ID}/schedule.png`,
        mime_type: 'image/png',
        file_size: 102400,
        processing_status: 'uploaded',
        processing_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockDoc, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);
      const created = await repo.createDocument(USER_A_ID, {
        document_type: 'timetable',
        file_name: 'schedule.png',
        storage_path: `${USER_A_ID}/${DOC_ID}/schedule.png`,
        mime_type: 'image/png',
        file_size: 102400,
      });

      expect(created.id).toBe(DOC_ID);
      expect(created.processing_status).toBe('uploaded');
    });
  });

  describe('Document Processing Pipeline Execution', () => {
    it('executes pipeline: downloads, extracts, validates, and sets status to needs_review', async () => {
      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        document_type: 'timetable',
        file_name: 'timetable.png',
        storage_path: `${USER_A_ID}/${DOC_ID}/timetable.png`,
        mime_type: 'image/png',
        file_size: 204800,
        processing_status: 'uploaded',
        processing_version: 1,
        latest_job: null,
      };

      const jobRecord = {
        id: JOB_ID,
        document_id: DOC_ID,
        status: 'processing',
        attempt_count: 1,
        started_at: new Date().toISOString(),
      };

      const docChain = createChainableMock(docRecord);
      const jobChain = createChainableMock(jobRecord);

      const updateJobSpy = vi.fn(() => jobChain);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
              update: vi.fn(() => docChain),
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => createChainableMock(null)),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: jobRecord, error: null }),
                }),
              }),
              update: updateJobSpy,
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            download: vi.fn().mockResolvedValue({
              data: {
                arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
              },
              error: null,
            }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const result = await DocumentProcessingService.processDocument(
        mockSupabase,
        USER_A_ID,
        DOC_ID
      );

      expect(result.status).toBe('needs_review');
      expect(result.documentId).toBe(DOC_ID);
      expect(updateJobSpy).toHaveBeenCalled();
    });

    it('fails safely when AI provider throws rate limit or error: preserves existing active schedules', async () => {
      mockAI.simulatedFailure = ERROR_CODES.AI_RATE_LIMIT;

      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        document_type: 'timetable',
        file_name: 'timetable.png',
        storage_path: `${USER_A_ID}/${DOC_ID}/timetable.png`,
        mime_type: 'image/png',
        file_size: 204800,
        processing_status: 'uploaded',
        processing_version: 1,
        latest_job: null,
      };

      const jobRecord = {
        id: JOB_ID,
        document_id: DOC_ID,
        status: 'processing',
        attempt_count: 1,
        started_at: new Date().toISOString(),
      };

      const docChain = createChainableMock(docRecord);
      const jobChain = createChainableMock(jobRecord);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
              update: vi.fn(() => docChain),
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => createChainableMock(null)),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: jobRecord, error: null }),
                }),
              }),
              update: vi.fn(() => jobChain),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            download: vi.fn().mockResolvedValue({
              data: {
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
              },
              error: null,
            }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const result = await DocumentProcessingService.processDocument(
        mockSupabase,
        USER_A_ID,
        DOC_ID
      );

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Transactional Timetable Commit & Rollback', () => {
    it('commits reviewed timetable atomically and marks document completed', async () => {
      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        academic_year_id: null,
        document_type: 'timetable',
        file_name: 'tt.png',
        storage_path: 'path',
        mime_type: 'image/png',
        file_size: 100,
        processing_status: 'needs_review',
        processing_version: 1,
      };

      const createdTimetable = {
        id: TIMETABLE_ID,
        user_id: USER_A_ID,
        name: 'Fall 2026 CS-A',
        effective_from: '2026-08-01',
        timezone: 'Asia/Kolkata',
        active: true,
      };

      const deactivateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const insertTimetableMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdTimetable, error: null }),
        }),
      });
      const insertEntriesMock = vi.fn().mockResolvedValue({ data: null, error: null });

      const docChain = createChainableMock(docRecord);
      const jobChain = createChainableMock({ id: JOB_ID, status: 'completed' });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
              update: vi.fn(() => docChain),
            };
          }
          if (table === 'timetables') {
            return {
              update: deactivateMock,
              insert: insertTimetableMock,
            };
          }
          if (table === 'timetable_entries') {
            return {
              insert: insertEntriesMock,
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => jobChain),
              update: vi.fn(() => jobChain),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);
      const timetable = await repo.commitTimetable(USER_A_ID, DOC_ID, JOB_ID, {
        name: 'Fall 2026 CS-A',
        effective_from: '2026-08-01',
        timezone: 'Asia/Kolkata',
        active: true,
        entries: [
          {
            day_of_week: 'monday',
            start_time: '09:00',
            end_time: '10:00',
            subject_name: 'Operating Systems',
            class_type: 'lecture',
            room: '301',
          },
        ],
      });

      expect(timetable.id).toBe(TIMETABLE_ID);
      expect(deactivateMock).toHaveBeenCalledWith({ active: false });
      expect(insertEntriesMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            timetable_id: TIMETABLE_ID,
            subject_name: 'Operating Systems',
            room: '301',
          }),
        ])
      );
    });

    it('rolls back timetable if inserting entries fails', async () => {
      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        academic_year_id: null,
        storage_path: 'path',
      };

      const createdTimetable = {
        id: TIMETABLE_ID,
        user_id: USER_A_ID,
      };

      const deleteTimetableMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const docChain = createChainableMock(docRecord);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
            };
          }
          if (table === 'timetables') {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: createdTimetable, error: null }),
                }),
              }),
              delete: deleteTimetableMock,
            };
          }
          if (table === 'timetable_entries') {
            return {
              insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Constraint Violation' } }),
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => createChainableMock(null)),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);

      await expect(
        repo.commitTimetable(USER_A_ID, DOC_ID, JOB_ID, {
          name: 'Broken Timetable',
          effective_from: '2026-08-01',
          timezone: 'Asia/Kolkata',
          active: true,
          entries: [
            {
              day_of_week: 'monday',
              start_time: '09:00',
              end_time: '10:00',
              subject_name: 'Faulty Entry',
              class_type: 'lecture',
            },
          ],
        })
      ).rejects.toThrowError('Failed to insert timetable entries');

      expect(deleteTimetableMock).toHaveBeenCalled();
    });
  });

  describe('Transactional Calendar Commit & Rollback', () => {
    it('commits reviewed calendar atomically and marks document completed', async () => {
      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        academic_year_id: null,
        storage_path: 'path',
      };

      const createdCalendar = {
        id: CALENDAR_ID,
        user_id: USER_A_ID,
        name: 'Spring 2027 Calendar',
        effective_from: '2027-01-01',
        active: true,
      };

      const insertEventsMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const docChain = createChainableMock(docRecord);
      const jobChain = createChainableMock({ id: JOB_ID, status: 'completed' });

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
              update: vi.fn(() => docChain),
            };
          }
          if (table === 'academic_calendars') {
            return {
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: createdCalendar, error: null }),
                }),
              }),
            };
          }
          if (table === 'calendar_events') {
            return {
              insert: insertEventsMock,
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => jobChain),
              update: vi.fn(() => jobChain),
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);
      const calendar = await repo.commitCalendar(USER_A_ID, DOC_ID, JOB_ID, {
        name: 'Spring 2027 Calendar',
        effective_from: '2027-01-01',
        active: true,
        events: [
          {
            event_date: '2027-01-26',
            event_type: 'holiday',
            title: 'Republic Day',
            is_holiday: true,
            is_teaching_day: false,
            affects_regular_schedule: true,
            metadata: {},
          },
        ],
      });

      expect(calendar.id).toBe(CALENDAR_ID);
      expect(insertEventsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            calendar_id: CALENDAR_ID,
            title: 'Republic Day',
            is_holiday: true,
          }),
        ])
      );
    });
  });

  describe('Duplicate Prevention & Reprocessing', () => {
    it('re-processes document by incrementing attempt count without duplicating document record', async () => {
      const existingJob = {
        id: JOB_ID,
        document_id: DOC_ID,
        status: 'needs_review',
        attempt_count: 1,
        started_at: '2026-09-01T00:00:00Z',
      };

      const docRecord = {
        id: DOC_ID,
        user_id: USER_A_ID,
        document_type: 'timetable',
        file_name: 'timetable.png',
        storage_path: `${USER_A_ID}/${DOC_ID}/timetable.png`,
        mime_type: 'image/png',
        file_size: 204800,
        processing_status: 'needs_review',
        processing_version: 1,
        latest_job: existingJob,
      };

      const docChain = createChainableMock(docRecord);
      const jobChain = createChainableMock({ ...existingJob, attempt_count: 2, status: 'needs_review' });

      const updateJobSpy = vi.fn(() => jobChain);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              select: vi.fn(() => docChain),
              update: vi.fn(() => docChain),
            };
          }
          if (table === 'document_processing_jobs') {
            return {
              select: vi.fn(() => jobChain),
              update: updateJobSpy,
            };
          }
          return {};
        }),
        storage: {
          from: vi.fn().mockReturnValue({
            download: vi.fn().mockResolvedValue({
              data: {
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
              },
              error: null,
            }),
            createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const result = await DocumentProcessingService.processDocument(
        mockSupabase,
        USER_A_ID,
        DOC_ID
      );

      expect(result.status).toBe('needs_review');
      expect(updateJobSpy).toHaveBeenCalled();
    });
  });

  describe('Cross-User Tenant Isolation & Security', () => {
    it('blocks access when document does not exist (NotFoundError)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn(() => createChainableMock(null)),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);

      await expect(repo.getDocumentById(USER_B_ID, DOC_ID)).rejects.toThrowError(NotFoundError);
    });

    it('blocks User B from accessing User A document with ForbiddenError', async () => {
      const docBelongingToA = {
        id: DOC_ID,
        user_id: USER_A_ID, // belongs to User A
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn(() => createChainableMock(docBelongingToA)),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);

      // User B attempts to access User A's document
      await expect(repo.getDocumentById(USER_B_ID, DOC_ID)).rejects.toThrowError(ForbiddenError);
    });

    it('blocks User B from committing User A document with ForbiddenError', async () => {
      const docBelongingToA = {
        id: DOC_ID,
        user_id: USER_A_ID, // belongs to User A
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn(() => createChainableMock(docBelongingToA)),
        }),
      } as unknown as SupabaseClient<Database>;

      const repo = new DocumentsRepository(mockSupabase);

      await expect(
        repo.commitTimetable(USER_B_ID, DOC_ID, JOB_ID, {
          name: 'Unauthorized Timetable',
          effective_from: '2026-08-01',
          timezone: 'Asia/Kolkata',
          active: true,
          entries: [
            {
              day_of_week: 'monday',
              start_time: '09:00',
              end_time: '10:00',
              subject_name: 'Hacked Entry',
              class_type: 'lecture',
            },
          ],
        })
      ).rejects.toThrowError(ForbiddenError);
    });
  });
});
