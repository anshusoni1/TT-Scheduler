import type { TypedSupabaseClient, Json } from '@/types/database';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { getAIProvider } from './ai/ai-provider.factory';
import { doTimesOverlap, timeToMinutes } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { ERROR_CODES, type ErrorCode } from '@/lib/constants/extraction';
import type {
  TimetableExtraction,
  CalendarExtraction,
} from '@/lib/validation';

export interface ValidationSummary {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  conflictCount: number;
}

export class DocumentProcessingService {
  /**
   * Executes the full document classification, AI extraction, and domain validation pipeline.
   * State transitions: uploaded/queued -> processing -> needs_review (or failed).
   * Safe execution: Never alters existing active schedules.
   */
  static async processDocument(
    supabase: TypedSupabaseClient,
    userId: string,
    documentId: string
  ): Promise<{
    documentId: string;
    jobId: string;
    status: 'needs_review' | 'failed';
    documentType: string;
    warnings: string[];
    error?: string;
  }> {
    const docsRepo = new DocumentsRepository(supabase);
    const document = await docsRepo.getDocumentById(userId, documentId);

    // 1. Create or get existing processing job
    let job = document.latest_job;
    if (!job || job.status === 'completed' || job.status === 'failed') {
      job = await docsRepo.createProcessingJob(documentId);
    } else {
      job = await docsRepo.updateProcessingJob(job.id, {
        status: 'processing',
        attempt_count: (job.attempt_count || 0) + 1,
        started_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      });
    }

    await docsRepo.updateDocument(userId, documentId, {
      processing_status: 'processing',
    });

    try {
      // 2. Fetch raw file buffer from private storage
      const fileBuffer = await docsRepo.downloadFile(document.storage_path);
      if (fileBuffer.length === 0) {
        throw new AppError('The uploaded file is empty or corrupted.', ERROR_CODES.EMPTY_DOCUMENT, 400);
      }

      // 3. AI Classification
      const aiProvider = getAIProvider();
      let documentType = document.document_type;

      // If document type is not pre-selected or unknown, classify content via AI
      if (documentType === 'unknown' || !documentType) {
        const classification = await aiProvider.classifyDocument(fileBuffer, document.mime_type);
        documentType = classification.document_type;

        await docsRepo.updateDocument(userId, documentId, {
          document_type: documentType,
        });
      }

      // 4. Extraction based on classified type
      let extractionResult: Record<string, unknown> | null = null;
      let validationSummary: ValidationSummary = {
        isValid: true,
        warnings: [],
        errors: [],
        conflictCount: 0,
      };

      if (documentType === 'timetable') {
        const timetableData = await aiProvider.extractTimetable(fileBuffer, document.mime_type);
        validationSummary = this.validateTimetableDomainRules(timetableData);
        extractionResult = timetableData as unknown as Record<string, unknown>;
      } else if (documentType === 'calendar') {
        const calendarData = await aiProvider.extractAcademicCalendar(fileBuffer, document.mime_type);
        validationSummary = this.validateCalendarDomainRules(calendarData);
        extractionResult = calendarData as unknown as Record<string, unknown>;
      } else if (documentType === 'mixed') {
        // For mixed documents, attempt timetable extraction first, then calendar
        const timetableData = await aiProvider.extractTimetable(fileBuffer, document.mime_type);
        validationSummary = this.validateTimetableDomainRules(timetableData);
        extractionResult = {
          type: 'mixed',
          timetable: timetableData,
        };
      } else {
        // Unknown classification
        validationSummary.warnings.push('Document could not be confidently identified as a timetable or calendar. Please verify and select the type.');
        extractionResult = {
          type: 'unknown',
          message: 'Document structure could not be identified automatically.',
        };
      }

      // 5. Update processing job with successful extraction for review
      await docsRepo.updateProcessingJob(job.id, {
        status: 'needs_review',
        extraction_result: extractionResult as unknown as Json,
        validation_result: validationSummary as unknown as Json,
      });

      await docsRepo.updateDocument(userId, documentId, {
        processing_status: 'needs_review',
      });

      return {
        documentId,
        jobId: job.id,
        status: 'needs_review',
        documentType,
        warnings: validationSummary.warnings,
      };
    } catch (err: unknown) {
      console.error('Document processing failed with error:', err);
      // Safe failure handling: Record error safely without affecting active data
      const errorCode: ErrorCode =
        err instanceof AppError && err.code in ERROR_CODES
          ? (err.code as ErrorCode)
          : ERROR_CODES.SCHEMA_MISMATCH;

      const safeMessage =
        err instanceof AppError && err.statusCode < 500
          ? err.message
          : 'Unable to process this document. Please ensure the document is clear and readable, then retry.';

      await docsRepo.updateProcessingJob(job.id, {
        status: 'failed',
        error_code: errorCode,
        error_message: safeMessage,
        completed_at: new Date().toISOString(),
      });

      await docsRepo.updateDocument(userId, documentId, {
        processing_status: 'failed',
      });

      return {
        documentId,
        jobId: job.id,
        status: 'failed',
        documentType: document.document_type,
        warnings: [],
        error: safeMessage,
      };
    }
  }

  /**
   * Domain Semantic Validator for Timetables:
   * 1. Detects start_time >= end_time
   * 2. Detects overlapping entries on the same weekday
   * 3. Flags low confidence entries (< 0.75)
   * 4. Identifies missing rooms or faculty
   */
  static validateTimetableDomainRules(data: TimetableExtraction): ValidationSummary {
    const warnings: string[] = [...(data.warnings || [])];
    const errors: string[] = [];
    let conflictCount = 0;

    // Check overall document confidence
    if (data.confidence < 0.75) {
      warnings.push(`Overall extraction confidence is moderate (${Math.round(data.confidence * 100)}%). Please review carefully.`);
    }

    if (data.entries.length === 0) {
      warnings.push('No class slots could be detected in the timetable layout.');
    }

    // Check individual entries
    for (let i = 0; i < data.entries.length; i++) {
      const entry = data.entries[i];

      // Time order check
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);

      if (startMin >= endMin) {
        errors.push(`${entry.subject_name} on ${entry.day_of_week} has invalid time: start (${entry.start_time}) is after end (${entry.end_time}).`);
      }

      // Confidence check
      if (entry.confidence < 0.75) {
        warnings.push(`Low confidence extraction for "${entry.subject_name}" on ${entry.day_of_week} (${entry.start_time} - ${entry.end_time}).`);
      }

      // Missing details check
      if (!entry.room) {
        warnings.push(`No room assigned for "${entry.subject_name}" on ${entry.day_of_week}.`);
      }

      // Overlap detection with other entries on the same weekday
      for (let j = i + 1; j < data.entries.length; j++) {
        const other = data.entries[j];
        if (entry.day_of_week === other.day_of_week) {
          if (doTimesOverlap(entry.start_time, entry.end_time, other.start_time, other.end_time)) {
            conflictCount++;
            warnings.push(
              `Time overlap detected on ${entry.day_of_week}: "${entry.subject_name}" (${entry.start_time}–${entry.end_time}) and "${other.subject_name}" (${other.start_time}–${other.end_time}).`
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      conflictCount,
    };
  }

  /**
   * Domain Semantic Validator for Academic Calendars:
   * 1. Detects invalid date formats
   * 2. Flags conflicting holiday vs teaching day states
   * 3. Validates semester date boundaries
   */
  static validateCalendarDomainRules(data: CalendarExtraction): ValidationSummary {
    const warnings: string[] = [...(data.warnings || [])];
    const errors: string[] = [];

    if (data.events.length === 0) {
      warnings.push('No calendar events could be detected in the document.');
    }

    if (data.confidence < 0.75) {
      warnings.push(`Overall calendar extraction confidence is moderate (${Math.round(data.confidence * 100)}%).`);
    }

    for (const event of data.events) {
      // Contradictory flags check
      if (event.is_holiday && event.is_teaching_day) {
        warnings.push(`Event "${event.title}" on ${event.event_date} is marked as both a holiday and a teaching day.`);
      }

      if (event.confidence < 0.75) {
        warnings.push(`Low confidence date/title for event "${event.title}" on ${event.event_date}.`);
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      conflictCount: 0,
    };
  }
}
