import type { SupabaseClient } from '@supabase/supabase-js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentType = 'timetable' | 'calendar' | 'mixed' | 'unknown';
export type ProcessingStatus = 'uploaded' | 'queued' | 'processing' | 'needs_review' | 'completed' | 'failed';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type EventType =
  | 'holiday'
  | 'teaching_day'
  | 'working_day'
  | 'exam'
  | 'special_event'
  | 'fest'
  | 'recess'
  | 'sports'
  | 'administrative'
  | 'special_teaching_day'
  | 'other';
export type ExceptionType = 'cancelled' | 'rescheduled' | 'room_change' | 'substitute' | 'extra_class' | 'date_holiday' | 'date_teaching_day';
export type ClassType = 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'other';

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  college: string | null;
  course: string | null;
  branch: string | null;
  semester: number | null;
  section: string | null;
  timezone: string;
  attendance_target_percentage: number;
  created_at: string;
  updated_at: string;
};

export type AcademicYear = {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  semester: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  document_type: DocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  processing_status: ProcessingStatus;
  processing_version: number;
  created_at: string;
  updated_at: string;
};

export type DocumentProcessingJob = {
  id: string;
  document_id: string;
  status: ProcessingStatus;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  extraction_result: Json | null;
  validation_result: Json | null;
  created_at: string;
  updated_at: string;
};

export type Timetable = {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  name: string;
  effective_from: string;
  effective_to: string | null;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TimetableEntry = {
  id: string;
  timetable_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subject_name: string;
  subject_code: string | null;
  faculty_name: string | null;
  room: string | null;
  class_type: ClassType;
  section: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicCalendar = {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  name: string;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  calendar_id: string;
  event_date: string;
  event_type: EventType;
  title: string;
  description: string | null;
  is_teaching_day: boolean;
  is_holiday: boolean;
  affects_regular_schedule: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ScheduleException = {
  id: string;
  user_id: string;
  date: string;
  exception_type: ExceptionType;
  original_timetable_entry_id: string | null;
  subject_name: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'not_marked';

export type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  timetable_entry_id: string | null;
  occurrence_context: string;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarFeedToken = {
  id: string;
  user_id: string;
  token: string;
  active: boolean;
  created_at: string;
  revoked_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          user_id: string;
          name: string;
          college?: string | null;
          course?: string | null;
          branch?: string | null;
          semester?: number | null;
          section?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          college?: string | null;
          course?: string | null;
          branch?: string | null;
          semester?: number | null;
          section?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_years: {
        Row: AcademicYear;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          start_date: string;
          end_date: string;
          semester?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          semester?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: DocumentRecord;
        Insert: {
          id?: string;
          user_id: string;
          academic_year_id?: string | null;
          document_type: DocumentType;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          processing_status?: ProcessingStatus;
          processing_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          academic_year_id?: string | null;
          document_type?: DocumentType;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          file_size?: number;
          processing_status?: ProcessingStatus;
          processing_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_processing_jobs: {
        Row: DocumentProcessingJob;
        Insert: {
          id?: string;
          document_id: string;
          status?: ProcessingStatus;
          attempt_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          extraction_result?: Json | null;
          validation_result?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          status?: ProcessingStatus;
          attempt_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          extraction_result?: Json | null;
          validation_result?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timetables: {
        Row: Timetable;
        Insert: {
          id?: string;
          user_id: string;
          academic_year_id?: string | null;
          name: string;
          effective_from: string;
          effective_to?: string | null;
          timezone?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          academic_year_id?: string | null;
          name?: string;
          effective_from?: string;
          effective_to?: string | null;
          timezone?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      timetable_entries: {
        Row: TimetableEntry;
        Insert: {
          id?: string;
          timetable_id: string;
          day_of_week: DayOfWeek;
          start_time: string;
          end_time: string;
          subject_name: string;
          subject_code?: string | null;
          faculty_name?: string | null;
          room?: string | null;
          class_type?: ClassType;
          section?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          timetable_id?: string;
          day_of_week?: DayOfWeek;
          start_time?: string;
          end_time?: string;
          subject_name?: string;
          subject_code?: string | null;
          faculty_name?: string | null;
          room?: string | null;
          class_type?: ClassType;
          section?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_calendars: {
        Row: AcademicCalendar;
        Insert: {
          id?: string;
          user_id: string;
          academic_year_id?: string | null;
          name: string;
          effective_from: string;
          effective_to?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          academic_year_id?: string | null;
          name?: string;
          effective_from?: string;
          effective_to?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: CalendarEvent;
        Insert: {
          id?: string;
          calendar_id: string;
          event_date: string;
          event_type: EventType;
          title: string;
          description?: string | null;
          is_teaching_day?: boolean;
          is_holiday?: boolean;
          affects_regular_schedule?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          calendar_id?: string;
          event_date?: string;
          event_type?: EventType;
          title?: string;
          description?: string | null;
          is_teaching_day?: boolean;
          is_holiday?: boolean;
          affects_regular_schedule?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_exceptions: {
        Row: ScheduleException;
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          exception_type: ExceptionType;
          original_timetable_entry_id?: string | null;
          subject_name?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          room?: string | null;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          exception_type?: ExceptionType;
          original_timetable_entry_id?: string | null;
          subject_name?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          room?: string | null;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_feed_tokens: {
        Row: CalendarFeedToken;
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          active?: boolean;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          active?: boolean;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: AttendanceRecord;
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          timetable_entry_id?: string | null;
          occurrence_context?: string;
          status: AttendanceStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          timetable_entry_id?: string | null;
          occurrence_context?: string;
          status?: AttendanceStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      document_type: DocumentType;
      processing_status: ProcessingStatus;
      day_of_week: DayOfWeek;
      class_type: ClassType;
      event_type: EventType;
      exception_type: ExceptionType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/**
 * Universal Typed Supabase Client compatible across SSR and standard client contexts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedSupabaseClient = SupabaseClient<Database, any, any>;
