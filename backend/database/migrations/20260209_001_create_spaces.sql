-- Migration: Create Spaces for Project Organization
-- Date: 2026-02-09
-- Purpose: Implement Spaces as top-level containers (Spaces → Projects → Tasks)
--
-- Changes:
--   1. Create spaces table with RLS policies
--   2. Add space_id, color, icon, sort_order columns to projects table
--   3. Support both company and personal modes
--
-- Backwards Compatibility:
--   - space_id is nullable (existing projects remain valid)
--   - ON DELETE SET NULL (deleting space doesn't delete projects)

BEGIN;

-- =============================================================================
-- STEP 1: Create Spaces Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS spaces (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3b82f6',
  icon VARCHAR(10) DEFAULT '📁',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  CONSTRAINT spaces_name_not_empty CHECK (name <> ''),
  CONSTRAINT spaces_name_length CHECK (LENGTH(name) <= 100),
  CONSTRAINT spaces_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Performance indexes
CREATE INDEX spaces_company_id_idx ON spaces(company_id);
CREATE INDEX spaces_created_by_idx ON spaces(created_by);
CREATE INDEX spaces_sort_order_idx ON spaces(company_id, sort_order);

-- Updated_at trigger
CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table and column comments
COMMENT ON TABLE spaces IS
'Top-level organizational containers. Hierarchy: Spaces → Projects → Tasks. Supports multi-tenant and personal mode.';

COMMENT ON COLUMN spaces.company_id IS
'Company ID for multi-tenant isolation. NULL = personal user space, NOT NULL = company space';

COMMENT ON COLUMN spaces.color IS
'Hex color code for visual identification (e.g., #3b82f6)';

COMMENT ON COLUMN spaces.icon IS
'Emoji icon for visual identification (e.g., 📁, 🚀, 💼)';

COMMENT ON COLUMN spaces.sort_order IS
'Display order in sidebar. Lower numbers appear first.';

-- =============================================================================
-- STEP 2: Modify Projects Table
-- =============================================================================

-- Add space_id column (nullable for backwards compatibility)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS space_id bigint REFERENCES spaces(id) ON DELETE SET NULL;

-- Add visual customization columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📁',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Add constraints
ALTER TABLE projects
  ADD CONSTRAINT projects_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

-- Create indexes for space-based queries
CREATE INDEX projects_space_id_idx ON projects(space_id);
CREATE INDEX projects_space_sort_idx ON projects(space_id, sort_order);

-- Column comments
COMMENT ON COLUMN projects.space_id IS
'Space container for organization. NULL = unassigned/root-level project';

COMMENT ON COLUMN projects.color IS
'Hex color code for visual identification';

COMMENT ON COLUMN projects.icon IS
'Emoji icon for visual identification';

COMMENT ON COLUMN projects.sort_order IS
'Display order within space. Lower numbers appear first.';

-- =============================================================================
-- STEP 3: RLS Policies for Spaces
-- =============================================================================

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces FORCE ROW LEVEL SECURITY;

-- SELECT: Company users see company spaces, personal users see own spaces
CREATE POLICY spaces_select_policy ON spaces
  FOR SELECT
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: user belongs to same company
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user sees own spaces
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create spaces
CREATE POLICY spaces_insert_policy ON spaces
  FOR INSERT
  WITH CHECK (
    auth.is_system_admin() = true
    OR
    -- Company mode: user belongs to company
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
      AND created_by = auth.uid()
    )
    OR
    -- Personal mode: user creates own spaces
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: All company users can update (consistent with projects policy)
CREATE POLICY spaces_update_policy ON spaces
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can update
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user updates own spaces
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: All company users can delete (consistent with projects policy)
CREATE POLICY spaces_delete_policy ON spaces
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can delete
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user deletes own spaces
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify spaces table structure
DO $$
BEGIN
  RAISE NOTICE 'Verifying spaces table structure...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'spaces'
ORDER BY ordinal_position;

-- Verify projects new columns
DO $$
BEGIN
  RAISE NOTICE 'Verifying projects table modifications...';
END $$;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN ('space_id', 'color', 'icon', 'sort_order')
ORDER BY column_name;

-- Verify RLS policies on spaces
DO $$
BEGIN
  RAISE NOTICE 'Verifying RLS policies on spaces...';
END $$;

SELECT
  schemaname,
  tablename,
  policyname,
  CASE
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
  END as operation,
  roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'spaces'
ORDER BY policyname;

-- Verify indexes
DO $$
BEGIN
  RAISE NOTICE 'Verifying indexes...';
END $$;

SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('spaces', 'projects')
  AND (
    indexname LIKE 'spaces_%'
    OR indexname LIKE 'projects_space_%'
  )
ORDER BY tablename, indexname;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 20260209_001_create_spaces completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created spaces table with 4 RLS policies';
  RAISE NOTICE '  - Added 4 columns to projects table (space_id, color, icon, sort_order)';
  RAISE NOTICE '  - Created 5 indexes for performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify the output above shows all tables/columns/policies';
  RAISE NOTICE '  2. Test creating a space via SQL or Supabase dashboard';
  RAISE NOTICE '  3. Proceed to implement space-service.js';
END $$;
