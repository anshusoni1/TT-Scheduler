import { z } from 'zod';

export const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Day of week enum schema
export const dayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

// Class type enum schema
export const classTypeSchema = z.enum(['lecture', 'lab', 'tutorial', 'seminar', 'other']);

// Event type enum schema
export const eventTypeSchema = z.enum([
  'holiday',
  'teaching_day',
  'working_day',
  'exam',
  'special_event',
  'fest',
  'recess',
  'sports',
  'administrative',
  'special_teaching_day',
  'other',
]);

// Exception type enum schema
export const exceptionTypeSchema = z.enum([
  'cancelled',
  'rescheduled',
  'room_change',
  'substitute',
  'extra_class',
  'date_holiday',
  'date_teaching_day',
]);

// Document type enum schema
export const documentTypeSchema = z.enum(['timetable', 'calendar', 'mixed', 'unknown']);

// Allowed MIME types
export const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const mimeTypeSchema = z.enum(allowedMimeTypes);

// Profile schema
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  college: z.string().trim().max(150).nullable().optional(),
  course: z.string().trim().max(100).nullable().optional(),
  branch: z.string().trim().max(100).nullable().optional(),
  semester: z.number().int().min(1).max(16).nullable().optional(),
  section: z.string().trim().max(50).nullable().optional(),
  timezone: z.string().trim().min(1).default('Asia/Kolkata'),
  attendance_target_percentage: z.number().min(1).max(100).default(75),
});

// Academic year schema
export const academicYearSchema = z
  .object({
    name: z.string().trim().min(1, 'Academic year name is required').max(50),
    start_date: z.string().regex(dateRegex, 'start_date must be in YYYY-MM-DD format'),
    end_date: z.string().regex(dateRegex, 'end_date must be in YYYY-MM-DD format'),
    semester: z.number().int().min(1).max(16).nullable().optional(),
    is_active: z.boolean().default(false),
  })
  .refine((data) => data.start_date <= data.end_date, {
    message: 'start_date must be before or equal to end_date',
    path: ['end_date'],
  });

// Timetable entry schema
export const timetableEntryBaseSchema = z.object({
  day_of_week: dayOfWeekSchema,
  start_time: z.string().regex(timeRegex, 'start_time must be HH:MM or HH:MM:SS (24-hour)'),
  end_time: z.string().regex(timeRegex, 'end_time must be HH:MM or HH:MM:SS (24-hour)'),
  subject_name: z.string().trim().min(1, 'Subject name is required').max(150),
  subject_code: z.string().trim().max(50).nullable().optional(),
  faculty_name: z.string().trim().max(100).nullable().optional(),
  room: z.string().trim().max(50).nullable().optional(),
  class_type: classTypeSchema.default('lecture'),
  section: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const timetableEntrySchema = timetableEntryBaseSchema.refine(
  (data) => {
    // Normalize to HH:MM for string comparison
    const start = data.start_time.slice(0, 5);
    const end = data.end_time.slice(0, 5);
    return start < end;
  },
  {
    message: 'start_time must be strictly before end_time',
    path: ['end_time'],
  }
);

export const updateTimetableEntrySchema = timetableEntryBaseSchema.partial().refine(
  (data) => {
    if (data.start_time && data.end_time) {
      const start = data.start_time.slice(0, 5);
      const end = data.end_time.slice(0, 5);
      return start < end;
    }
    return true;
  },
  {
    message: 'start_time must be strictly before end_time',
    path: ['end_time'],
  }
);

// Timetable schema
export const timetableSchema = z
  .object({
    academic_year_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, 'Timetable name is required').max(100),
    effective_from: z.string().regex(dateRegex, 'effective_from must be in YYYY-MM-DD format'),
    effective_to: z.string().regex(dateRegex, 'effective_to must be in YYYY-MM-DD format').nullable().optional(),
    timezone: z.string().trim().default('Asia/Kolkata'),
    active: z.boolean().default(true),
    entries: z.array(timetableEntrySchema).optional(),
  })
  .refine(
    (data) => {
      if (!data.effective_to) return true;
      return data.effective_from <= data.effective_to;
    },
    {
      message: 'effective_from must be before or equal to effective_to',
      path: ['effective_to'],
    }
  );

// Calendar event schema
export const calendarEventSchema = z.object({
  event_date: z.string().regex(dateRegex, 'event_date must be in YYYY-MM-DD format'),
  event_type: eventTypeSchema,
  title: z.string().trim().min(1, 'Event title is required').max(150),
  description: z.string().trim().max(500).nullable().optional(),
  is_teaching_day: z.boolean().default(false),
  is_holiday: z.boolean().default(false),
  affects_regular_schedule: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

export const updateCalendarEventSchema = calendarEventSchema.partial();

// Academic calendar schema
export const academicCalendarBaseSchema = z.object({
  academic_year_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Calendar name is required').max(100),
  effective_from: z.string().regex(dateRegex, 'effective_from must be in YYYY-MM-DD format'),
  effective_to: z.string().regex(dateRegex, 'effective_to must be in YYYY-MM-DD format').nullable().optional(),
  active: z.boolean().default(true),
  events: z.array(calendarEventSchema).optional(),
});

export const academicCalendarSchema = academicCalendarBaseSchema.refine(
  (data) => {
    if (!data.effective_to) return true;
    return data.effective_from <= data.effective_to;
  },
  {
    message: 'effective_from must be before or equal to effective_to',
    path: ['effective_to'],
  }
);

export const updateAcademicCalendarSchema = academicCalendarBaseSchema.partial().refine(
  (data) => {
    if (data.effective_from && data.effective_to) {
      return data.effective_from <= data.effective_to;
    }
    return true;
  },
  {
    message: 'effective_from must be before or equal to effective_to',
    path: ['effective_to'],
  }
);

// Schedule exception schema
export const scheduleExceptionBaseSchema = z.object({
  date: z.string().regex(dateRegex, 'date must be in YYYY-MM-DD format'),
  exception_type: exceptionTypeSchema,
  original_timetable_entry_id: z.string().uuid().nullable().optional(),
  subject_name: z.string().trim().max(150).nullable().optional(),
  start_time: z.string().regex(timeRegex).nullable().optional(),
  end_time: z.string().regex(timeRegex).nullable().optional(),
  room: z.string().trim().max(50).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const scheduleExceptionSchema = scheduleExceptionBaseSchema.refine(
  (data) => {
    if (data.start_time && data.end_time) {
      const start = data.start_time.slice(0, 5);
      const end = data.end_time.slice(0, 5);
      return start < end;
    }
    return true;
  },
  {
    message: 'start_time must be strictly before end_time when both are provided',
    path: ['end_time'],
  }
);

export const updateScheduleExceptionSchema = scheduleExceptionBaseSchema.partial().refine(
  (data) => {
    if (data.start_time && data.end_time) {
      const start = data.start_time.slice(0, 5);
      const end = data.end_time.slice(0, 5);
      return start < end;
    }
    return true;
  },
  {
    message: 'start_time must be strictly before end_time when both are provided',
    path: ['end_time'],
  }
);

// Document upload schema
export const documentUploadSchema = z.object({
  file_name: z.string().trim().min(1, 'File name is required'),
  mime_type: mimeTypeSchema,
  file_size: z.number().int().positive('File size must be positive').max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  document_type: documentTypeSchema.default('unknown'),
  academic_year_id: z.string().uuid().nullable().optional(),
});

// Document Classification Schema
export const documentClassificationSchema = z.object({
  document_type: z.enum(['timetable', 'calendar', 'mixed', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type DocumentClassification = z.infer<typeof documentClassificationSchema>;

// Extracted Timetable Entry Schema
export const extractedTimetableEntrySchema = z.object({
  day_of_week: dayOfWeekSchema,
  start_time: z.string().regex(timeRegex, 'Invalid start time (HH:MM)'),
  end_time: z.string().regex(timeRegex, 'Invalid end time (HH:MM)'),
  subject_name: z.string().trim().min(1, 'Subject name is required'),
  subject_code: z.string().trim().nullable().optional(),
  faculty_name: z.string().trim().nullable().optional(),
  room: z.string().trim().nullable().optional(),
  class_type: classTypeSchema.default('lecture'),
  section: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.9),
  warnings: z.array(z.string()).default([]),
});

export type ExtractedTimetableEntry = z.infer<typeof extractedTimetableEntrySchema>;

// Extracted Timetable Payload Schema
export const timetableExtractionSchema = z.object({
  academic_year: z.string().nullable().optional(),
  semester: z.number().int().min(1).max(12).nullable().optional(),
  section: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  timetable_title: z.string().trim().min(1).default('Extracted Timetable'),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
  entries: z.array(extractedTimetableEntrySchema),
});

export type TimetableExtraction = z.infer<typeof timetableExtractionSchema>;

// Extracted Calendar Event Schema
export const extractedCalendarEventSchema = z.object({
  event_date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  event_type: eventTypeSchema,
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().nullable().optional(),
  is_teaching_day: z.boolean().default(false),
  is_holiday: z.boolean().default(false),
  affects_regular_schedule: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.9),
  warnings: z.array(z.string()).default([]),
});

export type ExtractedCalendarEvent = z.infer<typeof extractedCalendarEventSchema>;

// Extracted Calendar Payload Schema
export const calendarExtractionSchema = z.object({
  academic_year: z.string().nullable().optional(),
  calendar_title: z.string().trim().min(1).default('Extracted Academic Calendar'),
  effective_from: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  effective_to: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD').nullable().optional(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
  events: z.array(extractedCalendarEventSchema),
});

export type CalendarExtraction = z.infer<typeof calendarExtractionSchema>;

// Confirm and Commit Timetable Schema
export const confirmTimetableExtractionSchema = z.object({
  name: z.string().trim().min(1).max(150),
  effective_from: z.string().regex(dateRegex),
  effective_to: z.string().regex(dateRegex).nullable().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  active: z.boolean().default(true),
  entries: z.array(timetableEntrySchema).min(1, 'At least one timetable entry is required'),
});

export type ConfirmTimetableInput = z.infer<typeof confirmTimetableExtractionSchema>;

export const confirmCalendarExtractionSchema = z.object({
  name: z.string().trim().min(1).max(150),
  effective_from: z.string().regex(dateRegex),
  effective_to: z.string().regex(dateRegex).nullable().optional(),
  active: z.boolean().default(true),
  events: z.array(calendarEventSchema).min(1, 'At least one calendar event is required'),
});

export type ConfirmCalendarInput = z.infer<typeof confirmCalendarExtractionSchema>;

// Attendance Tracking Validation Schemas
export const attendanceStatusSchema = z.enum(['present', 'absent', 'excused', 'not_marked']);

export const markAttendanceSchema = z.object({
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  timetable_entry_id: z.string().uuid('Invalid timetable entry ID').nullable().optional(),
  occurrence_context: z.string().trim().max(100).default('regular'),
  status: attendanceStatusSchema,
  notes: z.string().trim().max(500).nullable().optional(),
});

export type MarkAttendanceSchemaInput = z.infer<typeof markAttendanceSchema>;
