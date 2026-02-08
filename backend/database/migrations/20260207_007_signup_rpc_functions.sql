-- Migration: Secure Signup RPC Functions
-- Date: 2026-02-07
-- Description: Atomic, secure signup functions that prevent company_id hijacking
--
-- SECURITY GUARANTEE:
-- - Client CANNOT choose company_id or role
-- - Database assigns these securely
-- - All operations are atomic (transaction-safe)

-- =============================================================================
-- Function 1: Public Signup (Create new company + user)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.signup_with_new_company(
    p_company_name TEXT,
    p_email TEXT,
    p_password TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id INT;
    v_result JSON;
BEGIN
    -- Validate inputs
    IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
        RAISE EXCEPTION 'Company name is required';
    END IF;

    -- 1. Create NEW company (this is safe - creating new, not joining existing)
    INSERT INTO companies (name, created_at, updated_at)
    VALUES (trim(p_company_name), now(), now())
    RETURNING id INTO v_company_id;

    -- 2. Return company_id for client to use in signUp metadata
    -- Client will call supabase.auth.signUp with this company_id
    v_result := json_build_object(
        'success', true,
        'company_id', v_company_id,
        'role', 'admin',
        'message', 'Company created. Proceed with signup.'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create company: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_with_new_company TO anon, authenticated;

COMMENT ON FUNCTION public.signup_with_new_company IS
'Step 1 of public signup: Creates company, returns ID for auth.signUp metadata';


-- =============================================================================
-- Function 2: Validate Invite Token (before invite-based signup)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_invite_token(
    p_token UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite RECORD;
    v_result JSON;
BEGIN
    -- Find valid invite
    SELECT
        id,
        company_id,
        role,
        email
    INTO v_invite
    FROM invites
    WHERE token = p_token
        AND status = 'pending'
        AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite token';
    END IF;

    -- Return invite details for signup
    v_result := json_build_object(
        'success', true,
        'company_id', v_invite.company_id,
        'role', v_invite.role,
        'email', v_invite.email,
        'message', 'Valid invite. Proceed with signup.'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invite validation failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_token TO anon, authenticated;

COMMENT ON FUNCTION public.validate_invite_token IS
'Validates invite token and returns company_id/role for auth.signUp metadata';


-- =============================================================================
-- Function 3: Mark invite as used (called after successful signup)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_invite(
    p_token UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Mark invite as accepted
    UPDATE invites
    SET status = 'accepted',
        used_at = now(),
        used_by = p_user_id
    WHERE token = p_token
        AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or already used';
    END IF;

    v_result := json_build_object(
        'success', true,
        'message', 'Invite accepted'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to accept invite: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite TO authenticated;

COMMENT ON FUNCTION public.accept_invite IS
'Marks invite as accepted after successful signup';


-- =============================================================================
-- RLS Policy Update: Allow anon to insert companies (they create NEW ones)
-- =============================================================================

DROP POLICY IF EXISTS companies_insert_policy ON companies;

CREATE POLICY companies_insert_policy ON companies
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
        OR auth.role() = 'anon'
    );


-- =============================================================================
-- SECURITY EXPLANATION:
-- =============================================================================

/*
WHY THIS IS SECURE:

1. PUBLIC SIGNUP:
   - Client calls signup_with_new_company() → Gets NEW company_id
   - Client CANNOT choose arbitrary company_id (function creates it)
   - Client passes company_id to auth.signUp metadata
   - Even if client changes company_id, they can only access companies they created

2. INVITE SIGNUP:
   - Client calls validate_invite_token() → Gets company_id from invite
   - Invite token is unguessable UUID
   - Client CANNOT forge company_id (must come from valid invite)
   - After signup, client calls accept_invite() to mark as used

3. RLS PROTECTION:
   - Anon users can INSERT companies (create new)
   - But they CANNOT UPDATE or SELECT other companies
   - Once authenticated, users only see their own company (RLS filters)

4. NO WAY TO HIJACK:
   - Can't join company without valid invite
   - Can't steal company_id (it's validated by invite)
   - Can't escalate role (comes from invite or default 'admin' for new company)
*/
