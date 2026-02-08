-- Migration: Verify and update RLS policies
-- Date: 2026-02-07
-- Description: Ensure RLS policies work with auth.users metadata
-- Reason: No changes needed - policies use helper functions which now read from auth.users

-- RLS policies remain the same since they use helper functions:
-- - (SELECT public.is_system_admin())
-- - (SELECT public.user_company_id())
-- - (SELECT public.is_company_admin())

-- These functions now read from auth.users metadata instead of public.users

-- Verify RLS is enabled on all tables
DO $$
BEGIN
    -- Companies
    EXECUTE 'ALTER TABLE companies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE companies FORCE ROW LEVEL SECURITY';

    -- Projects
    EXECUTE 'ALTER TABLE projects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE projects FORCE ROW LEVEL SECURITY';

    -- Tasks
    EXECUTE 'ALTER TABLE tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE tasks FORCE ROW LEVEL SECURITY';

    -- Attachments
    EXECUTE 'ALTER TABLE attachments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE attachments FORCE ROW LEVEL SECURITY';
END $$;

-- Update table comments to reflect auth.users usage
COMMENT ON TABLE companies IS 'RLS enabled: sys_admin sees all, users see their company. User data in auth.users metadata.';
COMMENT ON TABLE projects IS 'RLS enabled: company-scoped access. created_by references auth.users.id';
COMMENT ON TABLE tasks IS 'RLS enabled: company-scoped access. assigned_to/created_by reference auth.users.id';
COMMENT ON TABLE attachments IS 'RLS enabled: company-scoped access. uploaded_by references auth.users.id';

-- Note: Existing RLS policies continue to work because they use the helper functions
-- which have been updated to read from auth.users metadata
