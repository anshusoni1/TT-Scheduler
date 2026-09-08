import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { DocumentProcessingService } from '@/server/services/document-processing.service';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { apiSuccess, handleApiError } from '@/lib/errors';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await context.params;

    const repo = new DocumentsRepository(supabase);
    const document = await repo.getDocumentById(user.id, id);

    // Bump version for re-run audit trail
    await repo.updateDocument(user.id, id, {
      processing_version: (document.processing_version || 1) + 1,
      processing_status: 'queued',
    });

    const result = await DocumentProcessingService.processDocument(
      supabase,
      user.id,
      id
    );

    const updatedDocument = await repo.getDocumentById(user.id, id);

    return apiSuccess({
      document: updatedDocument,
      processing: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
