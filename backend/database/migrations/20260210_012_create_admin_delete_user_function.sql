-- Migration: Create admin function to properly delete users
-- Description: Allows admins to delete team members with proper cleanup

-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_delete_user(uuid);

-- Create function to delete a user (admin only)
CREATE OR REPLACE FUNCTION admin_delete_user(user_id_to_delete uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id bigint;
  v_user_company_id bigint;
  v_target_role text;
  v_result jsonb;
BEGIN
  -- Check if caller is admin
  IF NOT (is_system_admin() OR is_company_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can delete users'
    );
  END IF;

  -- Get current user's company
  v_user_company_id := user_company_id();

  -- Get target user's company and role
  SELECT company_id, role
  INTO v_company_id, v_target_role
  FROM profiles
  WHERE id = user_id_to_delete;

  -- Check if target user exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Prevent deleting yourself
  IF user_id_to_delete = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete yourself'
    );
  END IF;

  -- Check company match (unless sys_admin)
  -- Sys_admin can delete anyone, regular admin can only delete from their company
  IF NOT is_system_admin() THEN
    IF v_company_id IS DISTINCT FROM v_user_company_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Can only delete users from your own company'
      );
    END IF;
  END IF;

  -- Delete the profile (cascades will handle related data)
  DELETE FROM profiles WHERE id = user_id_to_delete;

  -- Note: We cannot delete from auth.users from here due to RLS
  -- The auth.users record will remain but the user will have no profile
  -- and thus no access to the application

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User removed successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION admin_delete_user IS
'Allows admins to delete team members. Sys_admin can delete anyone except themselves. Regular admin can only delete users from their company. Removes profile and blocks access.';

-- Grant execute to authenticated users (RLS handled inside function)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
