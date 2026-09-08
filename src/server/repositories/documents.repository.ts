import type {
  TypedSupabaseClient,
  DocumentRecord,
  DocumentProcessingJob,
  Json,
  Timetable,
  AcademicCalendar,
} from '@/types/database';
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors';
import type {
  ConfirmTimetableInput,
  ConfirmCalendarInput,
} from '@/lib/validation';

export interface CreateDocumentInput {
  academic_year_id?: string | null;
  document_type: DocumentRecord['document_type'];
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
}

export interface DocumentWithJob extends DocumentRecord {
  latest_job: DocumentProcessingJob | null;
  signed_url?: string | null;
}

export class DocumentsRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  // ====================================================================
  // Supabase Storage Operations
  // ====================================================================

  /**
   * Uploads raw buffer to the private 'documents' bucket under user's path.
   */
  async uploadFile(
    userId: string,
    documentId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${documentId}/${sanitizedName}`;

    const { error } = await this.supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new AppError(`Storage upload failed: ${error.message}`, 'STORAGE_ERROR', 500, error);
    }

    return storagePath;
  }

  /**
   * Downloads file buffer from the private 'documents' bucket.
   */
  async downloadFile(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from('documents')
      .download(storagePath);

    if (error || !data) {
      throw new AppError(`Failed to download file from storage: ${error?.message || 'File not found'}`, 'STORAGE_ERROR', 404, error);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Generates a signed, temporary URL for secure browser viewing without exposing files publicly.
   */
  async getSignedUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new AppError(`Failed to generate signed URL: ${error?.message}`, 'STORAGE_ERROR', 500, error);
    }

    return data.signedUrl;
  }

  /**
   * Deletes a file from Supabase storage.
   */
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from('documents')
      .remove([storagePath]);

    if (error) {
      // Log error but don't fail operation if file was already removed
      console.warn(`Storage delete warning for ${storagePath}:`, error.message);
    }
  }

  // ====================================================================
  // Documents Table CRUD
  // ====================================================================

  /**
   * Creates a new document record.
   */
  async createDocument(
    userId: string,
    input: CreateDocumentInput
  ): Promise<DocumentRecord> {
    const { data, error } = await this.supabase
      .from('documents')
      .insert({
        user_id: userId,
        academic_year_id: input.academic_year_id ?? null,
        document_type: input.document_type,
        file_name: input.file_name,
        storage_path: input.storage_path,
        mime_type: input.mime_type,
        file_size: input.file_size,
        processing_status: 'uploaded',
        processing_version: 1,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to create document record: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  /**
   * Lists all documents for a user with their latest processing jobs.
   */
  async getUserDocuments(userId: string): Promise<DocumentWithJob[]> {
    const { data: documents, error: docsError } = await this.supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (docsError) {
      throw new AppError(`Failed to fetch documents: ${docsError.message}`, 'INTERNAL_ERROR', 500, docsError);
    }

    if (!documents || documents.length === 0) {
      return [];
    }

    const documentIds = documents.map((d) => d.id);
    const { data: jobs, error: jobsError } = await this.supabase
      .from('document_processing_jobs')
      .select('*')
      .in('document_id', documentIds)
      .order('created_at', { ascending: false });

    if (jobsError) {
      throw new AppError(`Failed to fetch processing jobs: ${jobsError.message}`, 'INTERNAL_ERROR', 500, jobsError);
    }

    const jobsByDoc = new Map<string, DocumentProcessingJob>();
    for (const job of jobs || []) {
      if (!jobsByDoc.has(job.document_id)) {
        jobsByDoc.set(job.document_id, job);
      }
    }

    return documents.map((doc) => ({
      ...doc,
      latest_job: jobsByDoc.get(doc.id) || null,
    }));
  }

  /**
   * Retrieves single document verifying tenant ownership.
   */
  async getDocumentById(userId: string, documentId: string): Promise<DocumentWithJob> {
    const { data: document, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch document: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    if (document.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to access this document');
    }

    const { data: job } = await this.supabase
      .from('document_processing_jobs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let signedUrl: string | null = null;
    try {
      signedUrl = await this.getSignedUrl(document.storage_path, 300);
    } catch {
      // Non-fatal if signed URL generation fails temporarily
    }

    return {
      ...document,
      latest_job: job || null,
      signed_url: signedUrl,
    };
  }

  /**
   * Updates document metadata / status.
   */
  async updateDocument(
    userId: string,
    documentId: string,
    updates: Partial<Pick<DocumentRecord, 'document_type' | 'processing_status' | 'processing_version'>>
  ): Promise<DocumentRecord> {
    await this.getDocumentById(userId, documentId);

    const { data, error } = await this.supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to update document: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  /**
   * Deletes a document and its storage file.
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const doc = await this.getDocumentById(userId, documentId);

    // Delete storage file
    await this.deleteFile(doc.storage_path);

    // Delete database row (cascades to document_processing_jobs)
    const { error } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(`Failed to delete document: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }

  // ====================================================================
  // Processing Jobs CRUD
  // ====================================================================

  /**
   * Creates a new processing job for a document.
   */
  async createProcessingJob(documentId: string): Promise<DocumentProcessingJob> {
    const { data, error } = await this.supabase
      .from('document_processing_jobs')
      .insert({
        document_id: documentId,
        status: 'queued',
        attempt_count: 1,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to create processing job: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  /**
   * Updates processing job status, error details, and extraction result.
   */
  async updateProcessingJob(
    jobId: string,
    updates: Partial<Omit<DocumentProcessingJob, 'id' | 'document_id' | 'created_at' | 'updated_at'>>
  ): Promise<DocumentProcessingJob> {
    const { data, error } = await this.supabase
      .from('document_processing_jobs')
      .update(updates)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to update processing job: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  // ====================================================================
  // Transactional Commit on User Confirmation
  // ====================================================================

  /**
   * Commits user-reviewed timetable extraction into production database.
   * Atomically:
   * 1. Inserts into timetables
   * 2. Inserts entries into timetable_entries
   * 3. Marks document and job as completed
   * Prevents duplicate entries through document_id / job linking.
   */
  async commitTimetable(
    userId: string,
    documentId: string,
    jobId: string,
    input: ConfirmTimetableInput
  ): Promise<Timetable> {
    const doc = await this.getDocumentById(userId, documentId);

    if (input.active) {
      // Deactivate other active timetables for user
      await this.supabase
        .from('timetables')
        .update({ active: false })
        .eq('user_id', userId);
    }

    // 1. Create timetable
    const { data: timetable, error: ttError } = await this.supabase
      .from('timetables')
      .insert({
        user_id: userId,
        academic_year_id: doc.academic_year_id,
        name: input.name,
        effective_from: input.effective_from,
        effective_to: input.effective_to ?? null,
        timezone: input.timezone,
        active: input.active,
      })
      .select('*')
      .single();

    if (ttError || !timetable) {
      throw new AppError(`Failed to commit timetable: ${ttError?.message}`, 'INTERNAL_ERROR', 500, ttError);
    }

    // 2. Insert entries
    if (input.entries.length > 0) {
      const entryPayloads = input.entries.map((entry) => ({
        timetable_id: timetable.id,
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        subject_name: entry.subject_name,
        subject_code: entry.subject_code ?? null,
        faculty_name: entry.faculty_name ?? null,
        room: entry.room ?? null,
        class_type: entry.class_type,
        section: entry.section ?? null,
        notes: entry.notes ?? null,
      }));

      const { error: entriesError } = await this.supabase
        .from('timetable_entries')
        .insert(entryPayloads);

      if (entriesError) {
        // Rollback created timetable
        await this.supabase.from('timetables').delete().eq('id', timetable.id);
        throw new AppError(`Failed to insert timetable entries: ${entriesError.message}`, 'INTERNAL_ERROR', 500, entriesError);
      }
    }

    // 3. Mark job and document completed
    await this.updateProcessingJob(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    await this.updateDocument(userId, documentId, {
      processing_status: 'completed',
    });

    return timetable;
  }

  /**
   * Commits user-reviewed academic calendar extraction into production database.
   */
  async commitCalendar(
    userId: string,
    documentId: string,
    jobId: string,
    input: ConfirmCalendarInput
  ): Promise<AcademicCalendar> {
    const doc = await this.getDocumentById(userId, documentId);

    if (input.active) {
      // Deactivate other active calendars for user
      await this.supabase
        .from('academic_calendars')
        .update({ active: false })
        .eq('user_id', userId);
    }

    // 1. Create academic calendar
    const { data: calendar, error: calError } = await this.supabase
      .from('academic_calendars')
      .insert({
        user_id: userId,
        academic_year_id: doc.academic_year_id,
        name: input.name,
        effective_from: input.effective_from,
        effective_to: input.effective_to ?? null,
        active: input.active,
      })
      .select('*')
      .single();

    if (calError || !calendar) {
      throw new AppError(`Failed to commit academic calendar: ${calError?.message}`, 'INTERNAL_ERROR', 500, calError);
    }

    // 2. Insert events
    if (input.events.length > 0) {
      const eventPayloads = input.events.map((event) => ({
        calendar_id: calendar.id,
        event_date: event.event_date,
        event_type: event.event_type,
        title: event.title,
        description: event.description ?? null,
        is_teaching_day: event.is_teaching_day ?? false,
        is_holiday: event.is_holiday ?? false,
        affects_regular_schedule: event.affects_regular_schedule ?? true,
        metadata: (event.metadata ?? {}) as Json,
      }));

      const { error: eventsError } = await this.supabase
        .from('calendar_events')
        .insert(eventPayloads);

      if (eventsError) {
        // Rollback created calendar
        await this.supabase.from('academic_calendars').delete().eq('id', calendar.id);
        throw new AppError(`Failed to insert calendar events: ${eventsError.message}`, 'INTERNAL_ERROR', 500, eventsError);
      }
    }

    // 3. Mark job and document completed
    await this.updateProcessingJob(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    await this.updateDocument(userId, documentId, {
      processing_status: 'completed',
    });

    return calendar;
  }
}
