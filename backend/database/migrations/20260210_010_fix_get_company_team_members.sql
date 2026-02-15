/**
 * Fix get_company_team_members function type mismatch
 * Cast varchar(255) email to text to match return type
 */

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_company_team_members(bigint);

-- Recreate the function with proper type casting
CREATE OR REPLACE FUNCTION get_company_team_members(p_company_id bigint DEFAULT NULL)
RETURNS TABLE (
    user_id uuid,
    email text,
    full_name text,
    avatar_url text,
    role text,
    status text,
    status_message text,
    last_seen timestamptz,
    created_at timestamptz,
    id uuid  -- Add missing id column
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id bigint;
BEGIN
    v_company_id := COALESCE(p_company_id, user_company_id());

    RETURN QUERY
    SELECT
        p.id as user_id,
        u.email::text,  -- Cast to text
        (u.raw_user_meta_data->>'full_name')::text as full_name,
        (u.raw_user_meta_data->>'avatar_url')::text as avatar_url,
        p.role::text,  -- Cast to text
        COALESCE(us.status, 'offline')::text as status,
        us.status_message::text,
        us.last_seen,
        p.created_at,
        p.id  -- Return id as well
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN user_status us ON us.user_id = p.id
    WHERE p.company_id = v_company_id
        OR (v_company_id IS NULL AND p.company_id IS NULL)
    ORDER BY p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_company_team_members TO authenticated;

COMMENT ON FUNCTION get_company_team_members IS 'Get all team members in a company with their status. Uses SECURITY DEFINER to access auth.users.';
