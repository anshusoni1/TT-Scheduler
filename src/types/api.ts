export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'AI_PROCESSING_ERROR'
  | 'RATE_LIMITED'
  | 'AI_API_KEY_MISSING'
  | 'AI_RATE_LIMIT'
  | 'AI_TIMEOUT'
  | 'SCHEMA_MISMATCH'
  | 'FILE_CORRUPT'
  | 'UNSUPPORTED_MIME_TYPE'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_DOCUMENT'
  | 'STORAGE_ERROR'
  | 'INVALID_STATE'
  | 'TRANSACTION_FAILED';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
