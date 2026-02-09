-- Migration: Add cascade delete for attachments
-- Date: 2026-02-09
-- Purpose: Automatically delete attachments when task is deleted

BEGIN;

-- Step 1: Drop existing foreign key constraint
ALTER TABLE attachments
  DROP CONSTRAINT IF EXISTS attachments_task_id_fkey;

-- Step 2: Re-add foreign key with ON DELETE CASCADE
ALTER TABLE attachments
  ADD CONSTRAINT attachments_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES tasks(id)
  ON DELETE CASCADE;

-- Step 3: Create function to delete storage files when attachment record is deleted
CREATE OR REPLACE FUNCTION delete_attachment_storage_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete file from storage
  PERFORM storage.delete_object('task-attachments', OLD.file_path);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger to call function after attachment deletion
DROP TRIGGER IF EXISTS delete_attachment_storage_trigger ON attachments;

CREATE TRIGGER delete_attachment_storage_trigger
  AFTER DELETE ON attachments
  FOR EACH ROW
  EXECUTE FUNCTION delete_attachment_storage_file();

COMMENT ON FUNCTION delete_attachment_storage_file IS
'Automatically deletes the storage file when an attachment record is deleted';

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_006_cascade_delete_attachments completed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Added ON DELETE CASCADE to attachments.task_id';
  RAISE NOTICE '  - Created trigger to delete storage files automatically';
  RAISE NOTICE '  - Deleting a task now deletes all its attachments AND files';
  RAISE NOTICE '';
END $$;
