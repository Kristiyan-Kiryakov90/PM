-- Migration: Restrict project CRUD operations to admins only
-- Date: 2026-02-15
-- Description: Update RLS policies so only admin/sys_admin can create, update, delete projects

-- Drop existing policies
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- INSERT: Only admins can create projects
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  WITH CHECK (
    is_system_admin() = true
    OR
    -- Company mode: user must be admin of the company
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
      AND is_company_admin() = true
    )
    OR
    -- Personal mode: any user can create personal projects
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: Only admins can update projects
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (
    is_system_admin() = true
    OR
    -- Company mode: user must be admin of the company
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
      AND is_company_admin() = true
    )
    OR
    -- Personal mode: user updates own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: Only admins can delete projects
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (
    is_system_admin() = true
    OR
    -- Company mode: user must be admin of the company
    (
      company_id = user_company_id()
      AND user_company_id() IS NOT NULL
      AND is_company_admin() = true
    )
    OR
    -- Personal mode: user deletes own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );
