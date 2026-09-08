-- ====================================================================
-- ClassFlow Phase 10 & 11: Calendar Feed Tokens & Attendance Tracking
-- Migration: 20260907000004_attendance_and_calendar_feed.sql
-- ====================================================================

-- 1. Extend profiles with configurable attendance target threshold
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS attendance_target_percentage NUMERIC NOT NULL DEFAULT 75
CHECK (attendance_target_percentage > 0 AND attendance_target_percentage <= 100);

-- 2. Create calendar feed tokens table for secure per-user iCalendar subscription feeds
CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Indexes for fast token lookup and user management
CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_lookup ON public.calendar_feed_tokens (token) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_user ON public.calendar_feed_tokens (user_id);

-- Enable RLS on calendar_feed_tokens
ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_feed_tokens_select_owner" ON public.calendar_feed_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "calendar_feed_tokens_insert_owner" ON public.calendar_feed_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_feed_tokens_update_owner" ON public.calendar_feed_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "calendar_feed_tokens_delete_owner" ON public.calendar_feed_tokens
    FOR DELETE USING (auth.uid() = user_id);


-- 3. Create attendance_records table for explicit student attendance tracking
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    timetable_entry_id UUID REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
    occurrence_context TEXT NOT NULL DEFAULT 'regular',
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'not_marked')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attendance_occurrence UNIQUE (user_id, date, timetable_entry_id, occurrence_context)
);

-- Indexes for fast occurrence resolution and subject aggregations
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON public.attendance_records (user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_entry ON public.attendance_records (user_id, timetable_entry_id);

-- Trigger for auto-updating updated_at timestamp
CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

-- Enable RLS on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_records_select_owner" ON public.attendance_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "attendance_records_insert_owner" ON public.attendance_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attendance_records_update_owner" ON public.attendance_records
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "attendance_records_delete_owner" ON public.attendance_records
    FOR DELETE USING (auth.uid() = user_id);
