/**
 * Fix profiles RLS policies to allow company admins to manage team members
 * Company admins should be able to update/delete profiles in their company
 */

-- Drop existing restrictive policies
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;

-- Update policy: Allow sys_admin OR company admin to update profiles in their company
CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (
        is_system_admin() = true
        OR (
            is_company_admin() = true
            AND company_id = user_company_id()
            AND id != auth.uid()  -- Can't update own profile (prevents privilege escalation)
        )
    );

-- Delete policy: Allow sys_admin OR company admin to delete profiles in their company
CREATE POLICY profiles_delete_policy ON profiles
    FOR DELETE
    USING (
        is_system_admin() = true
        OR (
            is_company_admin() = true
            AND company_id = user_company_id()
            AND id != auth.uid()  -- Can't delete own profile
        )
    );

COMMENT ON POLICY profiles_update_policy ON profiles IS 'Allow sys_admin or company admin to update profiles. Admins cannot update their own profile to prevent privilege escalation.';
COMMENT ON POLICY profiles_delete_policy ON profiles IS 'Allow sys_admin or company admin to delete profiles. Admins cannot delete their own profile.';
