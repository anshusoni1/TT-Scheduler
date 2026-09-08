import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import {
  confirmTimetableExtractionSchema,
  confirmCalendarExtractionSchema,
} from '@/lib/validation';
import { apiSuccess, handleApiError, ValidationError, AppError } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await context.params;
    const body = await request.json();

    const repo = new DocumentsRepository(supabase);
    const document = await repo.getDocumentById(user.id, id);

    if (!document.latest_job) {
      throw new AppError('No processing job exists for this document', 'INVALID_STATE', 400);
    }

    if (document.processing_status !== 'needs_review' && document.processing_status !== 'completed') {
      throw new AppError(
        `Cannot confirm document in '${document.processing_status}' state. Document must be in 'needs_review' state.`,
        'INVALID_STATE',
        400
      );
    }

    const type = body.document_type || document.document_type;

    if (type === 'timetable') {
      const parseResult = confirmTimetableExtractionSchema.safeParse(body.data || body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors[0]?.message || 'Invalid timetable confirmation input',
          parseResult.error.flatten()
        );
      }

      const committed = await repo.commitTimetable(
        user.id,
        document.id,
        document.latest_job.id,
        parseResult.data
      );

      return apiSuccess({
        message: 'Timetable confirmed and committed successfully to database.',
        type: 'timetable',
        timetable: committed,
      });
    } else if (type === 'calendar') {
      const parseResult = confirmCalendarExtractionSchema.safeParse(body.data || body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors[0]?.message || 'Invalid calendar confirmation input',
          parseResult.error.flatten()
        );
      }

      const committed = await repo.commitCalendar(
        user.id,
        document.id,
        document.latest_job.id,
        parseResult.data
      );

      return apiSuccess({
        message: 'Academic calendar confirmed and committed successfully to database.',
        type: 'calendar',
        calendar: committed,
      });
    } else {
      throw new ValidationError(`Unsupported document confirmation type: '${type}'. Please specify 'timetable' or 'calendar'.`);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
