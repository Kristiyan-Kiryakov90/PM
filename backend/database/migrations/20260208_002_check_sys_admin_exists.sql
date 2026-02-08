-- Migration: Add check_sys_admin_exists RPC function
-- Date: 2026-02-08
-- Description: Allows anonymous users to check if a sys_admin already exists
-- Reason: Landing page needs to know whether to show bootstrap modal

CREATE OR REPLACE FUNCTION public.check_sys_admin_exists()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM auth.users
        WHERE raw_user_meta_data->>'role' = 'sys_admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.check_sys_admin_exists TO anon, authenticated;

COMMENT ON FUNCTION public.check_sys_admin_exists IS
'Returns true if any sys_admin user exists. Callable by anonymous users for bootstrap check on landing page.';
