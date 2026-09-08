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
    return apiSuccess({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const { id } = await context.params;
    const repo = new DocumentsRepository(supabase);

    await repo.deleteDocument(user.id, id);
    return apiSuccess({ message: 'Document deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
