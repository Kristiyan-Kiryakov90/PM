-- Migration: Make project_id nullable in tasks table
-- Date: 2026-02-09
-- Purpose: Allow tasks to exist without being attached to a project

BEGIN;

-- Remove NOT NULL constraint from project_id
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN tasks.project_id IS
'Project the task belongs to. NULL = standalone task not attached to any project.';

-- Verify the change
DO $$
BEGIN
  RAISE NOTICE 'Verifying project_id is now nullable...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name = 'project_id';

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_004_make_project_id_nullable completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - project_id column in tasks table is now nullable';
  RAISE NOTICE '  - Tasks can now exist without being attached to a project';
  RAISE NOTICE '';
END $$;
