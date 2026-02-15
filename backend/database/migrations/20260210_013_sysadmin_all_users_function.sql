-- Migration: Sys Admin - View all users and companies
-- Description: Allows sys_admin to view all users across all companies and manage them

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_all_users_with_companies();

-- Create function to get all users with company info (sys_admin only)
CREATE OR REPLACE FUNCTION get_all_users_with_companies()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  company_id bigint,
  company_name text,
  status text,
  last_seen timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is sys_admin
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Only sys_admin can view all users';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(au.email, '') as email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, '') as full_name,
    p.role,
    p.company_id,
    COALESCE(c.name, 'Personal') as company_name,
    COALESCE(us.status, 'offline') as status,
    us.last_seen,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN companies c ON c.id = p.company_id
  LEFT JOIN user_status us ON us.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_all_users_with_companies IS
'Returns all users with company information. Only accessible by sys_admin.';

-- Grant execute to authenticated users (RLS handled inside function)
GRANT EXECUTE ON FUNCTION get_all_users_with_companies() TO authenticated;


-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_all_companies();

-- Create function to get all companies (sys_admin only)
CREATE OR REPLACE FUNCTION get_all_companies()
RETURNS TABLE (
  id bigint,
  name text,
  created_at timestamptz,
  user_count bigint,
  project_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is sys_admin
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Only sys_admin can view all companies';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.created_at,
    COUNT(DISTINCT p.id) as user_count,
    COUNT(DISTINCT pr.id) as project_count
  FROM companies c
  LEFT JOIN profiles p ON p.company_id = c.id
  LEFT JOIN projects pr ON pr.company_id = c.id
  GROUP BY c.id, c.name, c.created_at
  ORDER BY c.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_all_companies IS
'Returns all companies with user and project counts. Only accessible by sys_admin.';

-- Grant execute to authenticated users (RLS handled inside function)
GRANT EXECUTE ON FUNCTION get_all_companies() TO authenticated;
