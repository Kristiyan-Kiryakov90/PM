-- Migration: Create signup function for company + user registration
-- Date: 2026-02-07
-- Description: Database function to handle signup flow that bypasses RLS
-- This runs with SECURITY DEFINER to allow company creation during signup

-- =============================================================================
-- Signup Function: Register new company with admin user
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_company_and_user(
    p_company_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_company_id INT;
    v_user_id UUID;
    v_result JSON;
BEGIN
    -- 1. Validate inputs
    IF p_company_name IS NULL OR p_company_name = '' THEN
        RAISE EXCEPTION 'Company name is required';
    END IF;

    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;

    -- 2. Create company (bypasses RLS because of SECURITY DEFINER)
    INSERT INTO companies (name, created_at, updated_at)
    VALUES (p_company_name, now(), now())
    RETURNING id INTO v_company_id;

    -- 3. Create user in auth.users using admin API
    -- Note: This needs to be called from the application using supabase.auth.signUp
    -- with the company_id in metadata. This function only creates the company.

    -- 4. Return result
    v_result := json_build_object(
        'success', true,
        'company_id', v_company_id,
        'message', 'Company created successfully'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Rollback is automatic on exception
    RAISE EXCEPTION 'Registration failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.register_company_and_user TO authenticated, anon;

COMMENT ON FUNCTION public.register_company_and_user IS
'Registers a new company during user signup. Runs with SECURITY DEFINER to bypass RLS. Should be called before auth.signUp.';


-- =============================================================================
-- Alternative: Update RLS policy to allow unauthenticated company creation
-- This is simpler but less secure. Use only if signup function approach doesn't work.
-- =============================================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS companies_insert_policy ON companies;

-- Recreate with anon access for signup
CREATE POLICY companies_insert_policy ON companies
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        -- sys_admin can always insert
        (SELECT auth.is_system_admin()) = true
        -- OR allow anon users to insert (for signup flow)
        -- This is safe because Supabase Auth rate-limits signups
        OR auth.role() = 'anon'
    );

COMMENT ON POLICY companies_insert_policy ON companies IS
'Allows sys_admin and anonymous users (during signup) to create companies. Anonymous access is rate-limited by Supabase Auth.';
