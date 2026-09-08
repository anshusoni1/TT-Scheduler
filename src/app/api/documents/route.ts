import { NextRequest } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { DocumentsRepository } from '@/server/repositories/documents.repository';
import { DocumentProcessingService } from '@/server/services/document-processing.service';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/constants/extraction';
import type { AllowedMimeType, DocumentType } from '@/lib/constants/extraction';
import { RateLimiter } from '@/lib/security/rate-limiter';

export async function GET() {
  try {
    const { user, supabase } = await AuthService.requireUser();
    const repo = new DocumentsRepository(supabase);

    const documents = await repo.getUserDocuments(user.id);
    return apiSuccess({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limit: max 10 uploads per hour per IP
    const clientId = RateLimiter.getClientIdentifier(request);
    await RateLimiter.checkLimit(clientId, 'document_upload', {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
    });

    const { user, supabase } = await AuthService.requireUser();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = (formData.get('document_type') as DocumentType) || 'unknown';
    const academicYearId = (formData.get('academic_year_id') as string) || null;

    if (!file) {
      throw new ValidationError('No file provided in the upload request');
    }

    // 1. Validate file size
    if (file.size === 0) {
      throw new ValidationError('The uploaded file is empty');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File size exceeds maximum allowed limit of 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
    }

    // 2. Validate MIME type
    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
      throw new ValidationError(`Unsupported file type: ${mimeType}. Please upload a JPG, PNG, WEBP, or PDF.`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Sanitize filename
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    // 3. Create document record & upload to Supabase Storage
    const repo = new DocumentsRepository(supabase);
    const documentId = crypto.randomUUID();

    const storagePath = await repo.uploadFile(
      user.id,
      documentId,
      fileBuffer,
      safeFileName,
      mimeType
    );

    const document = await repo.createDocument(user.id, {
      academic_year_id: academicYearId,
      document_type: documentType,
      file_name: safeFileName,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: file.size,
    });

    // 4. Automatically trigger processing job in the background or immediately
    // Run pipeline synchronously for immediate feedback
    const processingResult = await DocumentProcessingService.processDocument(
      supabase,
      user.id,
      document.id
    );

    const updatedDocument = await repo.getDocumentById(user.id, document.id);

    return apiSuccess(
      {
        document: updatedDocument,
        processing: processingResult,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
