-- Migration: Optimize tag usage counts (Fix N+1 query)
-- Date: 2026-02-16
-- Description: Creates RPC function to get tags with usage counts in a single query
--              Prevents N+1 query issue (1 + N queries for N tags)

-- Drop function if exists (for idempotent migration)
DROP FUNCTION IF EXISTS get_tags_with_usage();

-- Create function to get tags with usage counts
-- Returns all tags with their task counts in a single query using LEFT JOIN + GROUP BY
CREATE OR REPLACE FUNCTION get_tags_with_usage()
RETURNS TABLE (
  id bigint,
  name text,
  color text,
  company_id bigint,
  created_by uuid,
  created_at timestamptz,
  usage_count bigint
) AS $$
BEGIN
  -- Apply RLS filtering by using auth.user_company_id()
  RETURN QUERY
  SELECT
    tags.id,
    tags.name,
    tags.color,
    tags.company_id,
    tags.created_by,
    tags.created_at,
    COUNT(task_tags.task_id)::bigint as usage_count
  FROM tags
  LEFT JOIN task_tags ON tags.id = task_tags.tag_id
  WHERE
    -- Apply same RLS logic as tags table
    (tags.company_id = user_company_id() OR tags.company_id IS NULL)
    OR is_system_admin()
  GROUP BY tags.id, tags.name, tags.color, tags.company_id, tags.created_by, tags.created_at
  ORDER BY usage_count DESC, tags.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_tags_with_usage() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_tags_with_usage() IS 'Get all tags with usage counts in a single query (prevents N+1)';
