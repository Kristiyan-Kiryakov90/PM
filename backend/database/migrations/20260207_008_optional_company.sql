-- Migration: Make Company Optional (Personal vs Team Workspaces)
-- Date: 2026-02-07
-- Description: Support individual users and company users with proper isolation

-- =============================================================================
-- STEP 1: Make company_id OPTIONAL in all tables
-- =============================================================================

-- Projects can be personal (company_id NULL) or company-owned
ALTER TABLE projects
  ALTER COLUMN company_id DROP NOT NULL;

-- Tasks can be personal (company_id NULL) or company-owned
ALTER TABLE tasks
  ALTER COLUMN company_id DROP NOT NULL;

-- Attachments can be personal (company_id NULL) or company-owned
ALTER TABLE attachments
  ALTER COLUMN company_id DROP NOT NULL;

COMMENT ON COLUMN projects.company_id IS 'NULL = personal project, NOT NULL = company project';
COMMENT ON COLUMN tasks.company_id IS 'NULL = personal task, NOT NULL = company task';
COMMENT ON COLUMN attachments.company_id IS 'NULL = personal attachment, NOT NULL = company attachment';


-- =============================================================================
-- STEP 2: Update Helper Functions for Optional Company
-- =============================================================================

-- Update user_company_id to handle NULL (personal users)
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt()->>'user_metadata')::jsonb->>'company_id',
        NULL
    )::INT;
END;
$$;

COMMENT ON FUNCTION auth.user_company_id IS
'Returns user company_id or NULL for personal users';


-- =============================================================================
-- STEP 3: Drop and Recreate RLS Policies with Dual-Mode Isolation
-- =============================================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  PROJECTS TABLE - Personal + Company Mode                   │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- SELECT: Personal users see their own, company users see company projects
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    -- Personal mode: no company, see only own projects
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    -- Company mode: see all company projects
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

-- INSERT: Personal users create personal projects, company users create company projects
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  WITH CHECK (
    (SELECT auth.is_system_admin()) = true
    OR
    -- Personal mode: create personal project
    (
      (SELECT auth.user_company_id()) IS NULL
      AND company_id IS NULL
      AND created_by = auth.uid()
    )
    OR
    -- Company mode: create company project
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

-- UPDATE: Can update own personal projects OR company projects
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    -- Personal mode: update own projects
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    -- Company mode: update company projects
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

-- DELETE: Personal users delete own, company admins delete company projects
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    -- Personal mode: delete own projects
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    -- Company mode: admins delete company projects
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
      AND (SELECT auth.is_company_admin()) = true
    )
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  TASKS TABLE - Personal + Company Mode                      │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS tasks_select_policy ON tasks;
DROP POLICY IF EXISTS tasks_insert_policy ON tasks;
DROP POLICY IF EXISTS tasks_update_policy ON tasks;
DROP POLICY IF EXISTS tasks_delete_policy ON tasks;

CREATE POLICY tasks_select_policy ON tasks
  FOR SELECT
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY tasks_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND company_id IS NULL
      AND created_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY tasks_update_policy ON tasks
  FOR UPDATE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY tasks_delete_policy ON tasks
  FOR DELETE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND created_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  ATTACHMENTS TABLE - Personal + Company Mode                │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS attachments_select_policy ON attachments;
DROP POLICY IF EXISTS attachments_insert_policy ON attachments;
DROP POLICY IF EXISTS attachments_update_policy ON attachments;
DROP POLICY IF EXISTS attachments_delete_policy ON attachments;

CREATE POLICY attachments_select_policy ON attachments
  FOR SELECT
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND uploaded_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY attachments_insert_policy ON attachments
  FOR INSERT
  WITH CHECK (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND company_id IS NULL
      AND uploaded_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY attachments_update_policy ON attachments
  FOR UPDATE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND uploaded_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );

CREATE POLICY attachments_delete_policy ON attachments
  FOR DELETE
  USING (
    (SELECT auth.is_system_admin()) = true
    OR
    (
      (SELECT auth.user_company_id()) IS NULL
      AND uploaded_by = auth.uid()
    )
    OR
    (
      (SELECT auth.user_company_id()) IS NOT NULL
      AND company_id = (SELECT auth.user_company_id())
    )
  );


-- =============================================================================
-- STEP 4: Update Companies RLS - Keep restrictive (only sys_admin or anon)
-- =============================================================================

-- Companies policy stays mostly the same
-- Anon can create (for signup), authenticated users manage via functions

DROP POLICY IF EXISTS companies_insert_policy ON companies;

CREATE POLICY companies_insert_policy ON companies
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    (SELECT auth.is_system_admin()) = true
    OR auth.role() = 'anon'
    OR auth.role() = 'authenticated'  -- Allow authenticated users to create companies
  );


-- =============================================================================
-- STEP 5: Functions for Company Management
-- =============================================================================

-- Function: Simple signup (no company)
CREATE OR REPLACE FUNCTION public.signup_individual()
RETURNS JSON
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN json_build_object(
        'success', true,
        'message', 'Individual signup - no company needed',
        'company_id', NULL,
        'role', 'user'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_individual TO anon, authenticated;

COMMENT ON FUNCTION public.signup_individual IS
'Returns metadata for individual user signup (no company)';


-- Function: Create company (for existing user)
CREATE OR REPLACE FUNCTION public.create_user_company(
    p_company_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id INT;
    v_user_id UUID;
    v_result JSON;
BEGIN
    -- Get current user
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated';
    END IF;

    -- Check if user already has a company
    IF (SELECT auth.user_company_id()) IS NOT NULL THEN
        RAISE EXCEPTION 'User already belongs to a company';
    END IF;

    -- Create company
    INSERT INTO companies (name, created_at, updated_at)
    VALUES (trim(p_company_name), now(), now())
    RETURNING id INTO v_company_id;

    -- Update user metadata to link company and promote to admin
    -- This needs to be done via auth.updateUser in the client

    v_result := json_build_object(
        'success', true,
        'company_id', v_company_id,
        'role', 'admin',
        'message', 'Company created. Update user metadata to link.'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create company: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_company TO authenticated;

COMMENT ON FUNCTION public.create_user_company IS
'Creates a company for authenticated user and returns company_id to update user metadata';


-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE projects IS 'RLS enabled: Personal mode (created_by) or Company mode (company_id)';
COMMENT ON TABLE tasks IS 'RLS enabled: Personal mode (created_by) or Company mode (company_id)';
COMMENT ON TABLE attachments IS 'RLS enabled: Personal mode (uploaded_by) or Company mode (company_id)';
