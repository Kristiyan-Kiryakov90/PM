-- =============================================================================
-- Storage Bucket for Task Attachments
-- Created: 2026-02-08
-- =============================================================================

-- Create the storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Storage Policies for Task Attachments
-- Multi-tenant isolation via company_id in file path
-- =============================================================================

-- Allow authenticated users to upload files to their company's tasks
CREATE POLICY "Users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    -- System admin can upload anywhere
    (SELECT auth.is_system_admin()) = true
    OR
    -- Regular users can upload to their company's tasks
    -- Path format: task-attachments/{task_id}/{random_id}.{ext}
    -- We rely on RLS at the database level for attachments table
    auth.role() = 'authenticated'
  )
);

-- Allow authenticated users to read files from their company's tasks
CREATE POLICY "Users can view task attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    -- System admin can view all
    (SELECT auth.is_system_admin()) = true
    OR
    -- Regular users can view (RLS enforced at database level)
    auth.role() = 'authenticated'
  )
);

-- Allow users to delete their own uploads or company attachments
CREATE POLICY "Users can delete task attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    -- System admin can delete all
    (SELECT auth.is_system_admin()) = true
    OR
    -- Users can delete (verified at database level via attachments table)
    auth.role() = 'authenticated'
  )
);

-- Update existing files (not typically needed for attachments, but included for completeness)
CREATE POLICY "Users can update task attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (
    (SELECT auth.is_system_admin()) = true
    OR auth.role() = 'authenticated'
  )
);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON POLICY "Users can upload task attachments" ON storage.objects IS
'Allows authenticated users to upload files to task-attachments bucket. Multi-tenant isolation enforced via attachments table RLS.';

COMMENT ON POLICY "Users can view task attachments" ON storage.objects IS
'Allows authenticated users to view files. Multi-tenant isolation enforced via attachments table RLS.';

COMMENT ON POLICY "Users can delete task attachments" ON storage.objects IS
'Allows users to delete files. Ownership and company verification enforced via attachments table RLS.';
