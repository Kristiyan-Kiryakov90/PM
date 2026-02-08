-- Migration: Admin user management functions
-- Date: 2026-02-07
-- Description: Helper functions for admin user management
-- Reason: Admins need to manage users via admin panel

-- Note: User creation/deletion must be done via Supabase Auth Admin API
-- These functions are helpers for listing and checking permissions

-- Function to list all users in a company (for admins)
CREATE OR REPLACE FUNCTION public.list_company_users(target_company_id bigint DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    email text,
    role text,
    company_id bigint,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    email_confirmed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        u.id,
        u.email,
        u.raw_user_meta_data->>'role' AS role,
        (u.raw_user_meta_data->>'company_id')::bigint AS company_id,
        u.created_at,
        u.last_sign_in_at,
        u.email_confirmed_at
    FROM auth.users u
    WHERE
        -- sys_admin sees all users
        (
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'sys_admin'
            )
        )
        OR
        -- company admin sees their company users
        (
            EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' IN ('admin', 'sys_admin')
                AND (
                    target_company_id IS NULL
                    OR (raw_user_meta_data->>'company_id')::bigint = target_company_id
                )
            )
            AND (u.raw_user_meta_data->>'company_id')::bigint = target_company_id
        )
    ORDER BY u.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_company_users IS 'List users in a company (admin only). sys_admin sees all, company admin sees their company only.';

-- Function to check if current user can manage a specific user
CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        CASE
            -- sys_admin can manage anyone
            WHEN EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'sys_admin'
            ) THEN true
            -- company admin can manage users in their company (but not other admins/sys_admins)
            WHEN EXISTS (
                SELECT 1
                FROM auth.users current_user
                JOIN auth.users target_user ON target_user.id = target_user_id
                WHERE current_user.id = auth.uid()
                AND current_user.raw_user_meta_data->>'role' = 'admin'
                AND (current_user.raw_user_meta_data->>'company_id')::bigint = (target_user.raw_user_meta_data->>'company_id')::bigint
                AND target_user.raw_user_meta_data->>'role' = 'user'  -- Can only manage regular users
            ) THEN true
            ELSE false
        END;
$$;

COMMENT ON FUNCTION public.can_manage_user IS 'Check if current user has permission to manage target user';

-- Function to get user count by company
CREATE OR REPLACE FUNCTION public.get_company_user_count(target_company_id bigint)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COUNT(*)::integer
    FROM auth.users
    WHERE (raw_user_meta_data->>'company_id')::bigint = target_company_id;
$$;

COMMENT ON FUNCTION public.get_company_user_count IS 'Get total user count for a company';

-- Function to validate user creation permission
CREATE OR REPLACE FUNCTION public.can_create_user_in_company(target_company_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT
        CASE
            -- sys_admin can create users in any company
            WHEN EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'sys_admin'
            ) THEN true
            -- company admin can create users in their company
            WHEN EXISTS (
                SELECT 1 FROM auth.users
                WHERE id = auth.uid()
                AND raw_user_meta_data->>'role' = 'admin'
                AND (raw_user_meta_data->>'company_id')::bigint = target_company_id
            ) THEN true
            ELSE false
        END;
$$;

COMMENT ON FUNCTION public.can_create_user_in_company IS 'Check if current user can create users in target company';
