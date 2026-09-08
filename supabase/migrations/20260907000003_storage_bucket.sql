-- ====================================================================
-- MIGRATION 3: PRIVATE STORAGE BUCKET FOR DOCUMENTS
-- Configures the private 'documents' storage bucket and RLS policies
-- ====================================================================

-- 1. Create the private 'documents' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Storage Policies for 'documents' bucket
-- Authenticated users can upload to their own folder: {user_id}/*
CREATE POLICY "documents_storage_insert_owner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can read/download their own documents
CREATE POLICY "documents_storage_select_owner"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own documents
CREATE POLICY "documents_storage_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own documents
CREATE POLICY "documents_storage_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
