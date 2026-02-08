-- Migration: Update helper functions for auth.users
-- Date: 2026-02-07
-- Description: Update helper functions to work with auth.users metadata
-- Reason: Using auth.users only, no public.users table

-- Function to get user's company_id from auth.users metadata
CREATE OR REPLACE FUNCTION public.user_company_id()
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

COMMENT ON FUNCTION public.user_company_id IS 'Returns company_id from auth.users metadata';

-- Function to check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
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

COMMENT ON FUNCTION public.is_system_admin IS 'Returns true if user has sys_admin role';

-- Function to check if user is company admin (admin or sys_admin)
CREATE OR REPLACE FUNCTION public.is_company_admin()
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

COMMENT ON FUNCTION public.is_company_admin IS 'Returns true if user is admin or sys_admin';

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.user_role()
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

COMMENT ON FUNCTION public.user_role IS 'Returns user role from auth.users metadata';

-- Function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(check_company_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_user_meta_data->>'role' = 'sys_admin'
        ) THEN true
        WHEN EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND (raw_user_meta_data->>'company_id')::bigint = check_company_id
        ) THEN true
        ELSE false
    END;
$$;

COMMENT ON FUNCTION public.user_belongs_to_company IS 'Returns true if user belongs to company or is sys_admin';

-- Function to get current user info (for debugging)
CREATE OR REPLACE FUNCTION public.current_user_info()
RETURNS TABLE (
    user_id uuid,
    user_email text,
    user_role text,
    company_id bigint,
    created_at timestamptz
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
        (raw_user_meta_data->>'company_id')::bigint AS company_id,
        created_at
    FROM auth.users
    WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_info IS 'Debug function: returns current user info from auth.users';
