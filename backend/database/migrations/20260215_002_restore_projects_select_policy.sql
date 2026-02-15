-- Migration: Restore projects SELECT policy
-- Date: 2026-02-15
-- Description: Re-add SELECT policy that was accidentally not included in previous migration

-- SELECT: All users can view projects (company users see company data, personal users see own data)
CREATE POLICY projects_select_policy ON projects
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
    -- Personal mode: user sees own data
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );
