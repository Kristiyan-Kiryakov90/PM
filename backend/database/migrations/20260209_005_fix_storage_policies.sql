-- Migration: Fix Storage RLS Policies for task-attachments bucket
-- Date: 2026-02-09
-- Purpose: Allow authenticated users to upload, view, and delete attachments

BEGIN;

-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own attachments" ON storage.objects;

-- Policy 1: Allow authenticated users to INSERT (upload) files
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
);

-- Policy 2: Allow authenticated users to SELECT (view/download) files
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
);

-- Policy 3: Allow authenticated users to DELETE their own files
CREATE POLICY "Authenticated users can delete own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND auth.uid() = owner
);

-- Policy 4: Allow authenticated users to UPDATE their own files
CREATE POLICY "Authenticated users can update own attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'task-attachments'
  AND auth.uid() = owner
);

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_005_fix_storage_policies completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created/verified task-attachments storage bucket';
  RAISE NOTICE '  - Created 4 RLS policies for authenticated users';
  RAISE NOTICE '  - Users can now upload, view, and delete attachments';
  RAISE NOTICE '';
END $$;
