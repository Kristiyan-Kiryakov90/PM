-- Migration: Update Tags to Admin-Only Creation
-- Description: Only admins can create/edit/delete tags, users can only assign them
-- Phase: 3B - Tags/Labels (Approach 2)

-- =====================================================
-- DROP OLD RLS POLICIES
-- =====================================================
DROP POLICY IF EXISTS tags_insert_own ON tags;
DROP POLICY IF EXISTS tags_update_company ON tags;
DROP POLICY IF EXISTS tags_delete_company ON tags;

-- =====================================================
-- NEW RLS POLICIES: Admin-Only Tag Management
-- =====================================================

-- Policy: Only admins can create tags
CREATE POLICY tags_insert_admin_only ON tags
  FOR INSERT
  WITH CHECK (
    is_system_admin()
    OR is_company_admin()
  );

-- Policy: Only admins can update tags
CREATE POLICY tags_update_admin_only ON tags
  FOR UPDATE
  USING (
    is_system_admin()
    OR is_company_admin()
  );

-- Policy: Only admins can delete tags
CREATE POLICY tags_delete_admin_only ON tags
  FOR DELETE
  USING (
    is_system_admin()
    OR is_company_admin()
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY tags_insert_admin_only ON tags IS 'Only company admins can create new tags';
COMMENT ON POLICY tags_update_admin_only ON tags IS 'Only company admins can edit existing tags';
COMMENT ON POLICY tags_delete_admin_only ON tags IS 'Only company admins can delete tags';
