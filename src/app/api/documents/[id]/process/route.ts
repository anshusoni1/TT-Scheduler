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

    const result = await DocumentProcessingService.processDocument(
      supabase,
      user.id,
      id
    );

    const repo = new DocumentsRepository(supabase);
    const document = await repo.getDocumentById(user.id, id);

    return apiSuccess({
      document,
      processing: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
