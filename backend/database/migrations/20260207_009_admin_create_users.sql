-- Migration: Admin Functions for Creating Company Users
-- Date: 2026-02-07
-- Description: Allow company admins to create users with temporary passwords

-- =============================================================================
-- Admin Function: Create User for Company
-- =============================================================================
-- NOTE: This function is called from a backend Edge Function that has admin privileges
-- It cannot be called directly from client due to security (creating users requires admin API)
-- This is a helper that validates admin permissions

CREATE OR REPLACE FUNCTION public.validate_admin_can_create_user(
    p_admin_user_id UUID,
    p_target_email TEXT,
    p_target_role TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_admin_company_id INT;
    v_admin_role TEXT;
    v_result JSON;
BEGIN
    -- Get admin's company and role from auth.users metadata
    SELECT
        (raw_user_meta_data->>'company_id')::INT,
        raw_user_meta_data->>'role'
    INTO v_admin_company_id, v_admin_role
    FROM auth.users
    WHERE id = p_admin_user_id;

    -- Validate admin has a company
    IF v_admin_company_id IS NULL THEN
        RAISE EXCEPTION 'Only company admins can create users';
    END IF;

    -- Validate admin has admin or sys_admin role
    IF v_admin_role NOT IN ('admin', 'sys_admin') THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;

    -- Validate target role is not sys_admin (only sys_admin can create sys_admin)
    IF p_target_role = 'sys_admin' AND v_admin_role != 'sys_admin' THEN
        RAISE EXCEPTION 'Cannot create system admin users';
    END IF;

    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_target_email) THEN
        RAISE EXCEPTION 'User with this email already exists';
    END IF;

    -- Return validation success with company info
    v_result := json_build_object(
        'success', true,
        'company_id', v_admin_company_id,
        'approved_role', CASE
            WHEN p_target_role IN ('user', 'admin') THEN p_target_role
            ELSE 'user'
        END,
        'message', 'Admin validated, proceed with user creation'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Validation failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_admin_can_create_user TO authenticated;

COMMENT ON FUNCTION public.validate_admin_can_create_user IS
'Validates that requesting user is admin and can create users. Called before auth.admin.createUser';


-- =============================================================================
-- Edge Function Example (to be created in Supabase)
-- File: supabase/functions/admin-create-user/index.ts
-- =============================================================================

/*
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { email, firstName, lastName, role } = await req.json()

    // Create admin client (has service role permissions)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get requesting user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(token)

    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate admin can create user
    const { data: validation, error: validationError } = await supabaseAdmin
      .rpc('validate_admin_can_create_user', {
        p_admin_user_id: adminUser.id,
        p_target_email: email,
        p_target_role: role
      })

    if (validationError) throw validationError

    // Generate temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        company_id: validation.company_id,
        role: validation.approved_role,
        password_reset_required: true
      }
    })

    if (createError) throw createError

    // TODO: Send email to user with login credentials

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        temp_password: tempPassword  // In production, send via email only!
      },
      message: 'User created successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
*/


-- =============================================================================
-- Helper Function: Check if password reset required
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_password_reset_required()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
DECLARE
    v_reset_required BOOLEAN;
BEGIN
    SELECT COALESCE(
        (raw_user_meta_data->>'password_reset_required')::BOOLEAN,
        false
    )
    INTO v_reset_required
    FROM auth.users
    WHERE id = auth.uid();

    RETURN v_reset_required;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_password_reset_required TO authenticated;

COMMENT ON FUNCTION public.check_password_reset_required IS
'Checks if current user needs to reset their password (first login)';


-- =============================================================================
-- Helper Function: Clear password reset flag
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clear_password_reset_flag()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
    -- This should be called after user successfully resets password
    -- The actual password update happens via auth.updateUser in client
    -- This just confirms the flag should be cleared

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated';
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Password reset acknowledged. Update user metadata to clear flag.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_password_reset_flag TO authenticated;

COMMENT ON FUNCTION public.clear_password_reset_flag IS
'Validates password reset completion';


-- =============================================================================
-- FRONTEND USAGE EXAMPLES
-- =============================================================================

/*
// ===================================================================
// ADMIN: Create User
// ===================================================================

async function createTeamMember(email, firstName, lastName, role) {
  // Call Edge Function (requires admin role)
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role  // 'user' or 'admin'
    }
  })

  if (error) {
    alert('Failed to create user: ' + error.message)
    return
  }

  alert('User created! Temporary password: ' + data.user.temp_password)
  // In production: Send password via email, don't show in UI
}


// ===================================================================
// TEAM MEMBER: First Login
// ===================================================================

async function firstLogin(email, tempPassword) {
  // Step 1: Sign in with temp password
  const { data: session, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: tempPassword
  })

  if (error) {
    alert('Login failed: ' + error.message)
    return
  }

  // Step 2: Check if password reset required
  const { data: resetRequired } = await supabase
    .rpc('check_password_reset_required')

  if (resetRequired) {
    // Redirect to password reset page
    window.location.href = '/reset-password.html'
  } else {
    // Normal login
    window.location.href = '/dashboard.html'
  }
}


// ===================================================================
// TEAM MEMBER: Reset Password
// ===================================================================

async function resetPassword(newPassword) {
  // Update password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: {
      password_reset_required: false  // Clear flag
    }
  })

  if (error) {
    alert('Password reset failed: ' + error.message)
    return
  }

  alert('Password updated successfully!')
  window.location.href = '/dashboard.html'
}


// ===================================================================
// INDIVIDUAL: Upgrade to Company
// ===================================================================

async function createCompany(companyName) {
  // Create company
  const { data, error } = await supabase
    .rpc('create_user_company', {
      p_company_name: companyName
    })

  if (error) {
    alert('Failed to create company: ' + error.message)
    return
  }

  // Update user metadata to link company
  await supabase.auth.updateUser({
    data: {
      company_id: data.company_id,
      role: 'admin'
    }
  })

  alert('Company created! You are now a company admin.')
  window.location.reload()
}
*/
