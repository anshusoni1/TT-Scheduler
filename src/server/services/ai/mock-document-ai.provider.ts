import type { DocumentAIProvider } from './document-ai-provider.interface';
import type {
  DocumentClassification,
  TimetableExtraction,
  CalendarExtraction,
} from '@/lib/validation';
import { AppError } from '@/lib/errors';
import { ERROR_CODES, type ErrorCode } from '@/lib/constants/extraction';

export class MockDocumentAIProvider implements DocumentAIProvider {
  public classificationOverride: DocumentClassification | null = null;
  public timetableOverride: TimetableExtraction | null = null;
  public calendarOverride: CalendarExtraction | null = null;
  public simulatedFailure: ErrorCode | null = null;

  async classifyDocument(_buffer: Buffer, _mimeType: string): Promise<DocumentClassification> {
    void _buffer;
    void _mimeType;
    if (this.simulatedFailure) {
      this.throwSimulatedError(this.simulatedFailure);
    }

    if (this.classificationOverride) {
      return this.classificationOverride;
    }

    // Default mock classification
    return {
      document_type: 'timetable',
      confidence: 0.95,
      reasoning: 'Visual inspection shows a 5-day grid with class periods and subjects.',
    };
  }

  async extractTimetable(_buffer: Buffer, _mimeType: string): Promise<TimetableExtraction> {
    void _buffer;
    void _mimeType;
    if (this.simulatedFailure) {
      this.throwSimulatedError(this.simulatedFailure);
    }

    if (this.timetableOverride) {
      return this.timetableOverride;
    }

    // Realistic default timetable fixture
    return {
      academic_year: '2026-2027',
      semester: 5,
      section: 'A',
      branch: 'Computer Science',
      timezone: 'Asia/Kolkata',
      timetable_title: 'Semester 5 CS-A Timetable',
      confidence: 0.92,
      warnings: [],
      entries: [
        {
          day_of_week: 'monday',
          start_time: '09:00',
          end_time: '10:00',
          subject_name: 'Data Structures & Algorithms',
          subject_code: 'CS301',
          faculty_name: 'Dr. A. Sharma',
          room: 'L-201',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          confidence: 0.98,
          warnings: [],
        },
        {
          day_of_week: 'monday',
          start_time: '10:15',
          end_time: '11:15',
          subject_name: 'Database Management Systems',
          subject_code: 'CS302',
          faculty_name: 'Prof. K. Verma',
          room: 'L-201',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          confidence: 0.95,
          warnings: [],
        },
        {
          day_of_week: 'monday',
          start_time: '14:00',
          end_time: '16:00',
          subject_name: 'DBMS Laboratory',
          subject_code: 'CS302P',
          faculty_name: 'Prof. K. Verma',
          room: 'Lab-3',
          class_type: 'lab',
          section: 'A',
          notes: '2-hour practical lab block',
          confidence: 0.91,
          warnings: [],
        },
        {
          day_of_week: 'tuesday',
          start_time: '09:00',
          end_time: '10:00',
          subject_name: 'Operating Systems',
          subject_code: 'CS303',
          faculty_name: 'Dr. R. Sen',
          room: 'Room 304',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          confidence: 0.94,
          warnings: [],
        },
        {
          day_of_week: 'friday',
          start_time: '14:00',
          end_time: '15:00',
          subject_name: 'Computer Networks',
          subject_code: 'CS304',
          faculty_name: null,
          room: 'Hall B',
          class_type: 'lecture',
          section: 'A',
          notes: null,
          confidence: 0.72,
          warnings: ['Faculty name was obscured in the document cell'],
        },
      ],
    };
  }

  async extractAcademicCalendar(_buffer: Buffer, _mimeType: string): Promise<CalendarExtraction> {
    void _buffer;
    void _mimeType;
    if (this.simulatedFailure) {
      this.throwSimulatedError(this.simulatedFailure);
    }

    if (this.calendarOverride) {
      return this.calendarOverride;
    }

    // Realistic default calendar fixture
    return {
      academic_year: '2026-2027',
      calendar_title: 'Academic Calendar Fall 2026',
      effective_from: '2026-08-01',
      effective_to: '2026-12-31',
      confidence: 0.94,
      warnings: [],
      events: [
        {
          event_date: '2026-08-15',
          event_type: 'holiday',
          title: 'Independence Day',
          description: 'National holiday - Institute closed',
          is_teaching_day: false,
          is_holiday: true,
          affects_regular_schedule: true,
          metadata: {},
          confidence: 0.99,
          warnings: [],
        },
        {
          event_date: '2026-09-05',
          event_type: 'special_event',
          title: 'Teachers Day Celebrations',
          description: 'Half day cultural activities',
          is_teaching_day: true,
          is_holiday: false,
          affects_regular_schedule: false,
          metadata: {},
          confidence: 0.95,
          warnings: [],
        },
        {
          event_date: '2026-09-19',
          event_type: 'working_day',
          title: 'Working Saturday (Monday Time Table)',
          description: 'Compensatory instructional day following Monday order',
          is_teaching_day: true,
          is_holiday: false,
          affects_regular_schedule: true,
          metadata: { follows_day: 'monday' },
          confidence: 0.93,
          warnings: [],
        },
        {
          event_date: '2026-10-15',
          event_type: 'exam',
          title: 'Midterm Examination Week',
          description: 'Examinations scheduled for all branches',
          is_teaching_day: true,
          is_holiday: false,
          affects_regular_schedule: true,
          metadata: {},
          confidence: 0.92,
          warnings: [],
        },
      ],
    };
  }

  private throwSimulatedError(code: ErrorCode): never {
    switch (code) {
      case ERROR_CODES.AI_RATE_LIMIT:
        throw new AppError('AI rate limit reached', ERROR_CODES.AI_RATE_LIMIT, 429);
      case ERROR_CODES.AI_TIMEOUT:
        throw new AppError('AI processing timed out', ERROR_CODES.AI_TIMEOUT, 504);
      case ERROR_CODES.AI_API_KEY_MISSING:
        throw new AppError('Gemini API key is not configured', ERROR_CODES.AI_API_KEY_MISSING, 503);
      case ERROR_CODES.SCHEMA_MISMATCH:
        throw new AppError('AI returned invalid JSON schema', ERROR_CODES.SCHEMA_MISMATCH, 502);
      default:
        throw new AppError(`AI Error: ${code}`, code, 500);
    }
  }
}
