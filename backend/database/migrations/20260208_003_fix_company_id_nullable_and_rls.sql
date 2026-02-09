-- Migration: Fix company_id nullable and RLS policies
-- Date: 2026-02-08
-- Purpose:
--   1. Make company_id nullable in projects, tasks, attachments (support personal users)
--   2. Update RLS policies to allow all company users to CRUD (not just admins)
--
-- Background:
--   - Tasks were failing silently because company_id had NOT NULL constraint
--   - Projects couldn't be edited by regular users due to admin-only RLS policies
--   - Frontend code already implements company_id: companyId || null pattern

BEGIN;

-- ============================================================================
-- STEP 1: Make company_id nullable in all tables
-- ============================================================================

-- Projects table
ALTER TABLE projects
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN projects.company_id IS
  'Company ID for multi-tenant isolation. NULL = personal user, NOT NULL = company mode';

-- Tasks table
ALTER TABLE tasks
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN tasks.company_id IS
  'Company ID for multi-tenant isolation. NULL = personal user, NOT NULL = company mode';

-- Attachments table
ALTER TABLE attachments
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN attachments.company_id IS
  'Company ID for multi-tenant isolation. NULL = personal user, NOT NULL = company mode';

-- ============================================================================
-- STEP 2: Update RLS policies for projects table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- SELECT: Company users see company data, personal users see own data
CREATE POLICY projects_select_policy ON projects
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
    -- Personal mode: user sees own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create projects
CREATE POLICY projects_insert_policy ON projects
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
    -- Personal mode: user creates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: All company users can update (not just admins)
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can update (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user updates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: All company users can delete (not just admins)
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can delete (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user deletes own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- STEP 3: Update RLS policies for tasks table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS tasks_select_policy ON tasks;
DROP POLICY IF EXISTS tasks_insert_policy ON tasks;
DROP POLICY IF EXISTS tasks_update_policy ON tasks;
DROP POLICY IF EXISTS tasks_delete_policy ON tasks;

-- SELECT: Company users see company data, personal users see own data
CREATE POLICY tasks_select_policy ON tasks
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
    -- Personal mode: user sees own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create tasks
CREATE POLICY tasks_insert_policy ON tasks
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
    -- Personal mode: user creates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: All company users can update (not just admins)
CREATE POLICY tasks_update_policy ON tasks
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can update (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user updates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: All company users can delete (not just admins)
CREATE POLICY tasks_delete_policy ON tasks
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can delete (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user deletes own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: Update RLS policies for attachments table
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS attachments_select_policy ON attachments;
DROP POLICY IF EXISTS attachments_insert_policy ON attachments;
DROP POLICY IF EXISTS attachments_update_policy ON attachments;
DROP POLICY IF EXISTS attachments_delete_policy ON attachments;

-- SELECT: Company users see company data, personal users see own data
CREATE POLICY attachments_select_policy ON attachments
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
    -- Personal mode: user sees own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- INSERT: Any authenticated user can create attachments
CREATE POLICY attachments_insert_policy ON attachments
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
    -- Personal mode: user creates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: All company users can update (not just admins)
CREATE POLICY attachments_update_policy ON attachments
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can update (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user updates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: All company users can delete (not just admins)
CREATE POLICY attachments_delete_policy ON attachments
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    -- Company mode: ANY company user can delete (removed admin requirement)
    (
      company_id = auth.user_company_id()
      AND auth.user_company_id() IS NOT NULL
    )
    OR
    -- Personal mode: user deletes own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify company_id is now nullable
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'tasks', 'attachments')
  AND column_name = 'company_id'
ORDER BY table_name;

-- Verify policies exist
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
  END as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'tasks', 'attachments')
ORDER BY tablename, policyname;

COMMIT;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
--
-- 1. All three tables should show is_nullable = 'YES' for company_id
-- 2. Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- 3. Total of 12 policies across all three tables
--
-- Key Changes:
-- - Removed auth.is_company_admin() requirement from UPDATE/DELETE policies
-- - All company users can now CRUD projects, tasks, attachments
-- - Personal users (company_id IS NULL) have full access to their own data
-- - Data isolation maintained via company_id matching
