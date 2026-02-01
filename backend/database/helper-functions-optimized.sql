-- TaskFlow Helper Functions (Optimized for RLS Performance)
-- Functions for role checking and company isolation
-- Following Supabase Postgres Best Practices v1.1.0 Section 3.3

-- =============================================================================
-- Best Practice 3.3: Optimize RLS Policies for Performance
-- - Use SECURITY DEFINER functions (run as function owner, bypass RLS)
-- - Set search_path = '' for security (prevent search path attacks)
-- - Use SQL STABLE for read-only functions (query planner optimization)
-- - Keep functions simple and fast (they're called frequently in RLS)
-- =============================================================================


-- Function to get the current user's company_id from auth.users metadata
-- Best Practice 3.3: Will be wrapped in SELECT when used in RLS policies
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT (raw_user_meta_data->>'company_id')::bigint
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.user_company_id IS 'Returns company_id from current user metadata. Use in RLS: (SELECT auth.user_company_id()) = company_id';


-- Function to check if current user is a system admin
-- Returns TRUE for sys_admin role only
CREATE OR REPLACE FUNCTION auth.is_system_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (raw_user_meta_data->>'role' = 'sys_admin'),
        false
    )
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.is_system_admin IS 'Returns true if current user has sys_admin role. Use in RLS: (SELECT auth.is_system_admin())';


-- Function to check if current user is a company admin (admin or sys_admin)
-- Returns TRUE for both admin and sys_admin roles
CREATE OR REPLACE FUNCTION auth.is_company_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (raw_user_meta_data->>'role' IN ('admin', 'sys_admin')),
        false
    )
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.is_company_admin IS 'Returns true if current user has admin or sys_admin role. Use in RLS: (SELECT auth.is_company_admin())';


-- Function to get current user's role
-- Returns: 'sys_admin', 'admin', 'user', or NULL
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT raw_user_meta_data->>'role'
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.user_role IS 'Returns current user role: sys_admin, admin, user, or NULL';


-- Function to check if a user belongs to a specific company
-- Best Practice 3.3: Use security definer with indexed lookup
CREATE OR REPLACE FUNCTION auth.user_belongs_to_company(check_company_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    -- System admins can access all companies
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'sys_admin'
        ) THEN true
        -- Check if user's company_id matches
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_user_meta_data->>'company_id')::bigint = check_company_id
        ) THEN true
        ELSE false
    END;
$$;

COMMENT ON FUNCTION auth.user_belongs_to_company IS 'Returns true if user belongs to specified company or is sys_admin';


-- =============================================================================
-- Invite Management Functions
-- Best Practice 5.1: Keep transactions short, validation outside transaction
-- =============================================================================

-- Function to validate invite token and get company_id
-- Used during signup process
CREATE OR REPLACE FUNCTION public.validate_invite_token(invite_token uuid)
RETURNS TABLE (
    company_id bigint,
    role text,
    is_valid boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        i.company_id,
        i.role,
        (i.status = 'pending' AND i.expires_at > now()) AS is_valid
    FROM public.invites i
    WHERE i.token = invite_token;
$$;

COMMENT ON FUNCTION public.validate_invite_token IS 'Validates invite token and returns company_id, role, and validity status';


-- Function to mark invite as used
-- Best Practice 6.4: Use UPSERT pattern for atomic updates
CREATE OR REPLACE FUNCTION public.mark_invite_used(invite_token uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    UPDATE public.invites
    SET
        status = 'accepted',
        used_at = now()
    WHERE token = invite_token
        AND status = 'pending'
        AND expires_at > now();
$$;

COMMENT ON FUNCTION public.mark_invite_used IS 'Atomically marks invite as accepted. Only affects pending, non-expired invites';


-- Function to expire old invites
-- Can be called by pg_cron or manually
-- Returns count of expired invites
CREATE OR REPLACE FUNCTION public.expire_old_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    expired_count integer;
BEGIN
    UPDATE public.invites
    SET status = 'expired'
    WHERE status = 'pending'
        AND expires_at <= now();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_old_invites IS 'Expires all pending invites past their expiration date. Returns count of expired invites';


-- =============================================================================
-- Utility function for checking RLS policy effectiveness
-- Best Practice 3.3: Use for debugging RLS policies
-- =============================================================================

CREATE OR REPLACE FUNCTION auth.current_user_info()
RETURNS TABLE (
    user_id uuid,
    user_email text,
    user_role text,
    company_id bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        id AS user_id,
        email AS user_email,
        raw_user_meta_data->>'role' AS user_role,
        (raw_user_meta_data->>'company_id')::bigint AS company_id
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.current_user_info IS 'Debug function: returns current user info including role and company_id';
