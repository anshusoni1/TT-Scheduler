import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { apiSuccess, handleApiError } from '@/lib/errors';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await context.params;
    const repo = new DocumentsRepository(supabase);

    const document = await repo.getDocumentById(user.id, id);

    return apiSuccess({
      documentId: document.id,
      processingStatus: document.processing_status,
      processingVersion: document.processing_version,
      latestJob: document.latest_job,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
