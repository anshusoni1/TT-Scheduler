-- Migration: 20260907000002_calendar_event_types.sql
-- Description: Expand calendar_events event_type constraint to support extensible domain model:
--              teaching_day, working_day, special_event in addition to holiday, exam, etc.

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN (
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
    'other'
  ));

-- Ensure composite index for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range 
  ON public.calendar_events(calendar_id, event_date ASC);
