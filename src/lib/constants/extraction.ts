export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes

export const DOCUMENT_TYPES = ['timetable', 'calendar', 'mixed', 'unknown'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PROCESSING_STATUSES = [
  'uploaded',
  'queued',
  'processing',
  'needs_review',
  'completed',
  'failed',
] as const;

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export const ERROR_CODES = {
  AI_API_KEY_MISSING: 'AI_API_KEY_MISSING',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_TIMEOUT: 'AI_TIMEOUT',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  FILE_CORRUPT: 'FILE_CORRUPT',
  UNSUPPORTED_MIME_TYPE: 'UNSUPPORTED_MIME_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  EMPTY_DOCUMENT: 'EMPTY_DOCUMENT',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INVALID_STATE: 'INVALID_STATE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
