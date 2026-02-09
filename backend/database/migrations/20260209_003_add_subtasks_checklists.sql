-- Migration: Add Subtasks and Checklists
-- Date: 2026-02-09
-- Purpose: Enable task hierarchy and checklists for better task breakdown
--
-- Changes:
--   1. Add parent_task_id to tasks table for subtasks
--   2. Create checklists table
--   3. Create checklist_items table
--
-- Features:
--   - Tasks can have parent tasks (subtask hierarchy)
--   - Tasks can have multiple named checklists
--   - Checklist items can be assigned and have due dates

BEGIN;

-- =============================================================================
-- STEP 1: Add parent_task_id to tasks table
-- =============================================================================

-- Add parent_task_id column for subtask hierarchy
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id bigint REFERENCES tasks(id) ON DELETE CASCADE;

-- Create index for parent task queries
CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON tasks(parent_task_id);

COMMENT ON COLUMN tasks.parent_task_id IS
'Parent task ID for subtask hierarchy. NULL = root-level task, NOT NULL = subtask';

-- =============================================================================
-- STEP 2: Create Checklists Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS checklists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT checklist_title_not_empty CHECK (title <> ''),
  CONSTRAINT checklist_title_length CHECK (LENGTH(title) <= 100)
);

-- Performance indexes
CREATE INDEX checklists_task_id_idx ON checklists(task_id);
CREATE INDEX checklists_task_sort_idx ON checklists(task_id, sort_order);

-- Updated_at trigger
CREATE TRIGGER update_checklists_updated_at
  BEFORE UPDATE ON checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE checklists IS
'Named checklists within tasks. A task can have multiple checklists (e.g., "Requirements", "Testing Steps").';

COMMENT ON COLUMN checklists.title IS
'Name of the checklist (e.g., "Prerequisites", "Acceptance Criteria")';

COMMENT ON COLUMN checklists.sort_order IS
'Display order within the task. Lower numbers appear first.';

-- =============================================================================
-- STEP 3: Create Checklist Items Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS checklist_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checklist_id bigint NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT checklist_item_content_not_empty CHECK (content <> ''),
  CONSTRAINT checklist_item_content_length CHECK (LENGTH(content) <= 500)
);

-- Performance indexes
CREATE INDEX checklist_items_checklist_id_idx ON checklist_items(checklist_id);
CREATE INDEX checklist_items_checklist_sort_idx ON checklist_items(checklist_id, sort_order);
CREATE INDEX checklist_items_assigned_to_idx ON checklist_items(assigned_to);
CREATE INDEX checklist_items_due_date_idx ON checklist_items(due_date) WHERE due_date IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE checklist_items IS
'Individual items within checklists. Can be assigned to users and have due dates.';

COMMENT ON COLUMN checklist_items.content IS
'The checklist item text/description (max 500 chars)';

COMMENT ON COLUMN checklist_items.is_completed IS
'Whether the item is checked off';

COMMENT ON COLUMN checklist_items.completed_at IS
'When the item was completed';

COMMENT ON COLUMN checklist_items.completed_by IS
'User who completed the item';

COMMENT ON COLUMN checklist_items.assigned_to IS
'Optional: User assigned to complete this item';

COMMENT ON COLUMN checklist_items.due_date IS
'Optional: Due date for this specific item';

-- =============================================================================
-- STEP 4: RLS Policies for Checklists
-- =============================================================================

ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists FORCE ROW LEVEL SECURITY;

-- SELECT: Users can see checklists for tasks they can access
CREATE POLICY checklists_select_policy ON checklists
  FOR SELECT
  USING (
    is_system_admin() = true
    OR
    task_id IN (
      SELECT id FROM tasks
      WHERE
        -- Company mode
        (company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        -- Personal mode
        (company_id IS NULL AND created_by = auth.uid())
    )
  );

-- INSERT: Users can create checklists for tasks they can access
CREATE POLICY checklists_insert_policy ON checklists
  FOR INSERT
  WITH CHECK (
    is_system_admin() = true
    OR
    task_id IN (
      SELECT id FROM tasks
      WHERE
        (company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (company_id IS NULL AND created_by = auth.uid())
    )
  );

-- UPDATE: All company users can update checklists
CREATE POLICY checklists_update_policy ON checklists
  FOR UPDATE
  USING (
    is_system_admin() = true
    OR
    task_id IN (
      SELECT id FROM tasks
      WHERE
        (company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (company_id IS NULL AND created_by = auth.uid())
    )
  );

-- DELETE: All company users can delete checklists
CREATE POLICY checklists_delete_policy ON checklists
  FOR DELETE
  USING (
    is_system_admin() = true
    OR
    task_id IN (
      SELECT id FROM tasks
      WHERE
        (company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (company_id IS NULL AND created_by = auth.uid())
    )
  );

-- =============================================================================
-- STEP 5: RLS Policies for Checklist Items
-- =============================================================================

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items FORCE ROW LEVEL SECURITY;

-- SELECT: Users can see items for checklists they can access
CREATE POLICY checklist_items_select_policy ON checklist_items
  FOR SELECT
  USING (
    is_system_admin() = true
    OR
    checklist_id IN (
      SELECT c.id FROM checklists c
      INNER JOIN tasks t ON t.id = c.task_id
      WHERE
        (t.company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (t.company_id IS NULL AND t.created_by = auth.uid())
    )
  );

-- INSERT: Users can create items for checklists they can access
CREATE POLICY checklist_items_insert_policy ON checklist_items
  FOR INSERT
  WITH CHECK (
    is_system_admin() = true
    OR
    checklist_id IN (
      SELECT c.id FROM checklists c
      INNER JOIN tasks t ON t.id = c.task_id
      WHERE
        (t.company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (t.company_id IS NULL AND t.created_by = auth.uid())
    )
  );

-- UPDATE: All company users can update items
CREATE POLICY checklist_items_update_policy ON checklist_items
  FOR UPDATE
  USING (
    is_system_admin() = true
    OR
    checklist_id IN (
      SELECT c.id FROM checklists c
      INNER JOIN tasks t ON t.id = c.task_id
      WHERE
        (t.company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (t.company_id IS NULL AND t.created_by = auth.uid())
    )
  );

-- DELETE: All company users can delete items
CREATE POLICY checklist_items_delete_policy ON checklist_items
  FOR DELETE
  USING (
    is_system_admin() = true
    OR
    checklist_id IN (
      SELECT c.id FROM checklists c
      INNER JOIN tasks t ON t.id = c.task_id
      WHERE
        (t.company_id = user_company_id() AND user_company_id() IS NOT NULL)
        OR
        (t.company_id IS NULL AND t.created_by = auth.uid())
    )
  );

-- =============================================================================
-- STEP 6: Helper Functions
-- =============================================================================

-- Function to auto-update completed_at timestamp when item is checked
CREATE OR REPLACE FUNCTION update_checklist_item_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND OLD.is_completed = false THEN
    -- Item was just completed
    NEW.completed_at = NOW();
    NEW.completed_by = auth.uid();
  ELSIF NEW.is_completed = false AND OLD.is_completed = true THEN
    -- Item was unchecked
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update completed_at
CREATE TRIGGER checklist_item_completed_trigger
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_item_completed();

COMMENT ON FUNCTION update_checklist_item_completed IS
'Automatically sets completed_at and completed_by when an item is checked/unchecked.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify tasks.parent_task_id column
DO $$
BEGIN
  RAISE NOTICE 'Verifying tasks.parent_task_id column...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name = 'parent_task_id';

-- Verify checklists table
DO $$
BEGIN
  RAISE NOTICE 'Verifying checklists table...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checklists'
ORDER BY ordinal_position;

-- Verify checklist_items table
DO $$
BEGIN
  RAISE NOTICE 'Verifying checklist_items table...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'checklist_items'
ORDER BY ordinal_position;

-- Verify RLS policies
DO $$
BEGIN
  RAISE NOTICE 'Verifying RLS policies...';
END $$;

SELECT
  tablename,
  policyname,
  CASE
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
  END as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('checklists', 'checklist_items')
ORDER BY tablename, policyname;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_003_add_subtasks_checklists completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Added parent_task_id to tasks table';
  RAISE NOTICE '  - Created checklists table with 4 RLS policies';
  RAISE NOTICE '  - Created checklist_items table with 4 RLS policies';
  RAISE NOTICE '  - Added auto-update trigger for completed_at';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test creating a subtask by setting parent_task_id';
  RAISE NOTICE '  2. Test creating checklists and items';
  RAISE NOTICE '  3. Proceed to implement checklist-service.js';
END $$;
