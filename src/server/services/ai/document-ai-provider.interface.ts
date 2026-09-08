import type {
  DocumentClassification,
  TimetableExtraction,
  CalendarExtraction,
} from '@/lib/validation';

export interface DocumentAIProvider {
  /**
   * Classifies an uploaded document (timetable, calendar, mixed, unknown)
   * using multimodal visual/textual understanding.
   */
  classifyDocument(buffer: Buffer, mimeType: string): Promise<DocumentClassification>;

  /**
   * Extracts generic timetable schedule data from the document.
   * Handles various layouts: days as rows/columns, merged cells, labs/practicals,
   * breaks, multi-hour slots, faculty, rooms, section codes.
   */
  extractTimetable(buffer: Buffer, mimeType: string): Promise<TimetableExtraction>;

  /**
   * Extracts academic calendar events from the document.
   * Handles holidays, teaching days, working Saturdays, exams, and special events.
   */
  extractAcademicCalendar(buffer: Buffer, mimeType: string): Promise<CalendarExtraction>;
}
