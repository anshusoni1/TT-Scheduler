-- ====================================================================
-- CLASSFLOW: CORE DATABASE SCHEMA & INITIAL MIGRATION
-- Migration: 20260907000001_initial_schema.sql
-- Description: Production-grade normalized schema with RLS and indexes.
-- ====================================================================

-- 1. Helper Function: Automatic updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- TABLE 1: PROFILES
-- Stores user identity and academic cohort details
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    college TEXT,
    course TEXT,
    branch TEXT,
    semester INTEGER CHECK (semester IS NULL OR (semester >= 1 AND semester <= 16)),
    section TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 2: ACADEMIC YEARS
-- Tracks semesters and academic cycles per user
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    semester INTEGER CHECK (semester IS NULL OR (semester >= 1 AND semester <= 16)),
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_academic_year_dates CHECK (start_date <= end_date)
);

CREATE TRIGGER trg_academic_years_updated_at
BEFORE UPDATE ON public.academic_years
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 3: DOCUMENTS
-- Tracks uploaded timetable/calendar images or PDFs
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('timetable', 'calendar', 'mixed', 'unknown')),
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf')),
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'queued', 'processing', 'needs_review', 'completed', 'failed')),
    processing_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 4: DOCUMENT PROCESSING JOBS
-- Audit log and pipeline tracker for document extractions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.document_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'needs_review', 'completed', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    extraction_result JSONB,
    validation_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_document_processing_jobs_updated_at
BEFORE UPDATE ON public.document_processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 5: TIMETABLES
-- Holds versioned timetable sets for a student
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_timetable_dates CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE TRIGGER trg_timetables_updated_at
BEFORE UPDATE ON public.timetables
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 6: TIMETABLE ENTRIES
-- Individual recurring class slots within a timetable
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject_name TEXT NOT NULL,
    subject_code TEXT,
    faculty_name TEXT,
    room TEXT,
    class_type TEXT NOT NULL DEFAULT 'lecture' CHECK (class_type IN ('lecture', 'lab', 'tutorial', 'seminar', 'other')),
    section TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_timetable_entry_time CHECK (start_time < end_time)
);

CREATE TRIGGER trg_timetable_entries_updated_at
BEFORE UPDATE ON public.timetable_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 7: ACADEMIC CALENDARS
-- Institutional academic calendar container
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.academic_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_calendar_dates CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE TRIGGER trg_academic_calendars_updated_at
BEFORE UPDATE ON public.academic_calendars
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 8: CALENDAR EVENTS
-- Holidays, exams, special teaching days, and events
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES public.academic_calendars(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'exam', 'fest', 'recess', 'sports', 'administrative', 'special_teaching_day', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    is_teaching_day BOOLEAN NOT NULL DEFAULT false,
    is_holiday BOOLEAN NOT NULL DEFAULT false,
    affects_regular_schedule BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- TABLE 9: SCHEDULE EXCEPTIONS
-- Specific date overrides (cancelled classes, room changes, makeup classes)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exception_type TEXT NOT NULL CHECK (exception_type IN ('cancelled', 'rescheduled', 'room_change', 'substitute', 'extra_class', 'date_holiday', 'date_teaching_day')),
    original_timetable_entry_id UUID REFERENCES public.timetable_entries(id) ON DELETE SET NULL,
    subject_name TEXT,
    start_time TIME,
    end_time TIME,
    room TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_exception_time_range CHECK (start_time IS NULL OR end_time IS NULL OR start_time < end_time)
);

CREATE TRIGGER trg_schedule_exceptions_updated_at
BEFORE UPDATE ON public.schedule_exceptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====================================================================
-- DATABASE INDEXES
-- Optimized for high-throughput schedule queries and foreign keys
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_academic_years_user_id ON public.academic_years(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_active ON public.academic_years(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(user_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_doc_id ON public.document_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.document_processing_jobs(status);

CREATE INDEX IF NOT EXISTS idx_timetables_user_id ON public.timetables(user_id);
CREATE INDEX IF NOT EXISTS idx_timetables_active ON public.timetables(user_id, active);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_lookup ON public.timetable_entries(timetable_id, day_of_week, start_time);

CREATE INDEX IF NOT EXISTS idx_academic_calendars_user_id ON public.academic_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_calendars_active ON public.academic_calendars(user_id, active);

CREATE INDEX IF NOT EXISTS idx_calendar_events_lookup ON public.calendar_events(calendar_id, event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON public.calendar_events(calendar_id, event_type);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_lookup ON public.schedule_exceptions(user_id, date);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation. Zero cross-user leakage.
-- ====================================================================

-- 1. Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_owner" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_owner" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_owner" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Academic Years
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academic_years_select_owner" ON public.academic_years
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "academic_years_insert_owner" ON public.academic_years
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academic_years_update_owner" ON public.academic_years
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academic_years_delete_owner" ON public.academic_years
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_owner" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_owner" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_owner" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_delete_owner" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Document Processing Jobs (Linked through documents table)
ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processing_jobs_select_owner" ON public.document_processing_jobs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.document_processing_jobs.document_id
            AND public.documents.user_id = auth.uid()
        )
    );

CREATE POLICY "processing_jobs_insert_owner" ON public.document_processing_jobs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.document_processing_jobs.document_id
            AND public.documents.user_id = auth.uid()
        )
    );

CREATE POLICY "processing_jobs_update_owner" ON public.document_processing_jobs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.document_processing_jobs.document_id
            AND public.documents.user_id = auth.uid()
        )
    );

-- 5. Timetables
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetables_select_owner" ON public.timetables
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "timetables_insert_owner" ON public.timetables
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timetables_update_owner" ON public.timetables
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timetables_delete_owner" ON public.timetables
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Timetable Entries (Linked through timetables table)
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timetable_entries_select_owner" ON public.timetable_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.timetables
            WHERE public.timetables.id = public.timetable_entries.timetable_id
            AND public.timetables.user_id = auth.uid()
        )
    );

CREATE POLICY "timetable_entries_insert_owner" ON public.timetable_entries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.timetables
            WHERE public.timetables.id = public.timetable_entries.timetable_id
            AND public.timetables.user_id = auth.uid()
        )
    );

CREATE POLICY "timetable_entries_update_owner" ON public.timetable_entries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.timetables
            WHERE public.timetables.id = public.timetable_entries.timetable_id
            AND public.timetables.user_id = auth.uid()
        )
    );

CREATE POLICY "timetable_entries_delete_owner" ON public.timetable_entries
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.timetables
            WHERE public.timetables.id = public.timetable_entries.timetable_id
            AND public.timetables.user_id = auth.uid()
        )
    );

-- 7. Academic Calendars
ALTER TABLE public.academic_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academic_calendars_select_owner" ON public.academic_calendars
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "academic_calendars_insert_owner" ON public.academic_calendars
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academic_calendars_update_owner" ON public.academic_calendars
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academic_calendars_delete_owner" ON public.academic_calendars
    FOR DELETE USING (auth.uid() = user_id);

-- 8. Calendar Events (Linked through academic_calendars table)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_select_owner" ON public.calendar_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.academic_calendars
            WHERE public.academic_calendars.id = public.calendar_events.calendar_id
            AND public.academic_calendars.user_id = auth.uid()
        )
    );

CREATE POLICY "calendar_events_insert_owner" ON public.calendar_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.academic_calendars
            WHERE public.academic_calendars.id = public.calendar_events.calendar_id
            AND public.academic_calendars.user_id = auth.uid()
        )
    );

CREATE POLICY "calendar_events_update_owner" ON public.calendar_events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.academic_calendars
            WHERE public.academic_calendars.id = public.calendar_events.calendar_id
            AND public.academic_calendars.user_id = auth.uid()
        )
    );

CREATE POLICY "calendar_events_delete_owner" ON public.calendar_events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.academic_calendars
            WHERE public.academic_calendars.id = public.calendar_events.calendar_id
            AND public.academic_calendars.user_id = auth.uid()
        )
    );

-- 9. Schedule Exceptions
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_exceptions_select_owner" ON public.schedule_exceptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "schedule_exceptions_insert_owner" ON public.schedule_exceptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "schedule_exceptions_update_owner" ON public.schedule_exceptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "schedule_exceptions_delete_owner" ON public.schedule_exceptions
    FOR DELETE USING (auth.uid() = user_id);

-- ====================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH.USERS
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, name, timezone)
    VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Student'),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'Asia/Kolkata')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
