-- Migration: Custom Statuses per Project
-- Date: 2026-02-09
-- Purpose: Replace hardcoded statuses with configurable statuses per project
--
-- Changes:
--   1. Create status_definitions table
--   2. Remove CHECK constraint from tasks.status
--   3. Seed default statuses for existing projects
--
-- Backwards Compatibility:
--   - Existing tasks remain valid (status values preserved)
--   - Default statuses auto-created for new projects

BEGIN;

-- =============================================================================
-- STEP 1: Create Status Definitions Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS status_definitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT status_name_not_empty CHECK (name <> ''),
  CONSTRAINT status_slug_not_empty CHECK (slug <> ''),
  CONSTRAINT status_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  UNIQUE (project_id, slug)
);

-- Performance indexes
CREATE INDEX status_definitions_company_id_idx ON status_definitions(company_id);
CREATE INDEX status_definitions_project_id_idx ON status_definitions(project_id);
CREATE INDEX status_definitions_project_sort_idx ON status_definitions(project_id, sort_order);

-- Updated_at trigger
CREATE TRIGGER update_status_definitions_updated_at
  BEFORE UPDATE ON status_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table and column comments
COMMENT ON TABLE status_definitions IS
'Custom status definitions per project. Allows each project to define its own workflow statuses.';

COMMENT ON COLUMN status_definitions.company_id IS
'Company ID for multi-tenant isolation. NULL = personal user status';

COMMENT ON COLUMN status_definitions.slug IS
'URL-friendly identifier for the status (e.g., "in_progress")';

COMMENT ON COLUMN status_definitions.is_done IS
'Whether this status represents a completed state (affects completion calculations)';

COMMENT ON COLUMN status_definitions.is_default IS
'Whether this is the default status for new tasks in this project';

COMMENT ON COLUMN status_definitions.sort_order IS
'Display order in Kanban board. Lower numbers appear first (left).';

-- =============================================================================
-- STEP 2: Remove CHECK Constraint from tasks.status
-- =============================================================================

-- Drop the existing constraint that limits statuses to hardcoded values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

COMMENT ON COLUMN tasks.status IS
'Task status slug. References status_definitions.slug for the project.';

-- =============================================================================
-- STEP 3: Seed Default Statuses for Existing Projects
-- =============================================================================

-- Insert default statuses for all existing projects
-- This ensures backwards compatibility
INSERT INTO status_definitions (company_id, project_id, name, slug, color, sort_order, is_done, is_default)
SELECT
  p.company_id,
  p.id as project_id,
  'To Do',
  'todo',
  '#94a3b8',
  0,
  false,
  true  -- First status is default
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM status_definitions sd WHERE sd.project_id = p.id
);

INSERT INTO status_definitions (company_id, project_id, name, slug, color, sort_order, is_done, is_default)
SELECT
  p.company_id,
  p.id as project_id,
  'In Progress',
  'in_progress',
  '#3b82f6',
  1,
  false,
  false
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM status_definitions sd WHERE sd.project_id = p.id AND sd.slug = 'in_progress'
);

INSERT INTO status_definitions (company_id, project_id, name, slug, color, sort_order, is_done, is_default)
SELECT
  p.company_id,
  p.id as project_id,
  'Review',
  'review',
  '#f59e0b',
  2,
  false,
  false
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM status_definitions sd WHERE sd.project_id = p.id AND sd.slug = 'review'
);

INSERT INTO status_definitions (company_id, project_id, name, slug, color, sort_order, is_done, is_default)
SELECT
  p.company_id,
  p.id as project_id,
  'Done',
  'done',
  '#10b981',
  3,
  true,
  false
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM status_definitions sd WHERE sd.project_id = p.id AND sd.slug = 'done'
);

-- =============================================================================
-- STEP 4: RLS Policies for Status Definitions
-- =============================================================================

ALTER TABLE status_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_definitions FORCE ROW LEVEL SECURITY;

-- SELECT: Users see statuses for projects they can access
CREATE POLICY status_definitions_select_policy ON status_definitions
  FOR SELECT
  USING (
    is_system_admin() = true
    OR
    -- Company mode: user belongs to same company
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user owns the project
    (
      company_id IS NULL
      AND project_id IN (
        SELECT id FROM projects
        WHERE company_id IS NULL
        AND created_by = auth.uid()
      )
    )
  );

-- INSERT: Users can create statuses for their projects
CREATE POLICY status_definitions_insert_policy ON status_definitions
  FOR INSERT
  WITH CHECK (
    is_system_admin() = true
    OR
    -- Company mode: user belongs to company and project exists in company
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
      AND project_id IN (
        SELECT id FROM projects WHERE company_id = user_company_id()
      )
    )
    OR
    -- Personal mode: user owns the project
    (
      company_id IS NULL
      AND project_id IN (
        SELECT id FROM projects
        WHERE company_id IS NULL
        AND created_by = auth.uid()
      )
    )
  );

-- UPDATE: All company users can update statuses
CREATE POLICY status_definitions_update_policy ON status_definitions
  FOR UPDATE
  USING (
    is_system_admin() = true
    OR
    -- Company mode: ANY company user can update
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user owns the project
    (
      company_id IS NULL
      AND project_id IN (
        SELECT id FROM projects
        WHERE company_id IS NULL
        AND created_by = auth.uid()
      )
    )
  );

-- DELETE: All company users can delete statuses
CREATE POLICY status_definitions_delete_policy ON status_definitions
  FOR DELETE
  USING (
    is_system_admin() = true
    OR
    -- Company mode: ANY company user can delete
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user owns the project
    (
      company_id IS NULL
      AND project_id IN (
        SELECT id FROM projects
        WHERE company_id IS NULL
        AND created_by = auth.uid()
      )
    )
  );

-- =============================================================================
-- STEP 5: Create Helper Function for Default Statuses
-- =============================================================================

-- Function to create default statuses when a new project is created
CREATE OR REPLACE FUNCTION create_default_statuses_for_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default statuses for new project
  INSERT INTO status_definitions (company_id, project_id, name, slug, color, sort_order, is_done, is_default)
  VALUES
    (NEW.company_id, NEW.id, 'To Do', 'todo', '#94a3b8', 0, false, true),
    (NEW.company_id, NEW.id, 'In Progress', 'in_progress', '#3b82f6', 1, false, false),
    (NEW.company_id, NEW.id, 'Review', 'review', '#f59e0b', 2, false, false),
    (NEW.company_id, NEW.id, 'Done', 'done', '#10b981', 3, true, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create statuses for new projects
CREATE TRIGGER create_default_statuses_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_default_statuses_for_project();

COMMENT ON FUNCTION create_default_statuses_for_project IS
'Automatically creates default statuses (To Do, In Progress, Review, Done) when a new project is created.';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify status_definitions table
DO $$
BEGIN
  RAISE NOTICE 'Verifying status_definitions table...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'status_definitions'
ORDER BY ordinal_position;

-- Verify tasks constraint removed
DO $$
BEGIN
  RAISE NOTICE 'Verifying tasks.status constraint removed...';
END $$;

SELECT
  conname,
  contype
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND conname LIKE '%status%';

-- Verify default statuses created
DO $$
BEGIN
  RAISE NOTICE 'Verifying default statuses created...';
END $$;

SELECT
  p.id as project_id,
  p.name as project_name,
  COUNT(sd.id) as status_count
FROM projects p
LEFT JOIN status_definitions sd ON sd.project_id = p.id
GROUP BY p.id, p.name
ORDER BY p.id
LIMIT 5;

-- Verify RLS policies
DO $$
BEGIN
  RAISE NOTICE 'Verifying RLS policies on status_definitions...';
END $$;

SELECT
  policyname,
  CASE
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
  END as operation
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'status_definitions'
ORDER BY policyname;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_002_create_status_definitions completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created status_definitions table with 4 RLS policies';
  RAISE NOTICE '  - Removed CHECK constraint from tasks.status';
  RAISE NOTICE '  - Seeded default statuses for all existing projects';
  RAISE NOTICE '  - Created trigger to auto-create statuses for new projects';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify default statuses created for all projects';
  RAISE NOTICE '  2. Test creating a new project (should auto-create 4 statuses)';
  RAISE NOTICE '  3. Proceed to implement status-service.js';
END $$;
