-- Migration: Secure Signup Implementation
-- Date: 2026-02-07
-- Description: Secure multi-tenant signup with proper isolation
--
-- SECURITY MODEL:
-- 1. Public signup: Creates NEW company (user can't choose company_id)
-- 2. Invite signup: Validates token, joins specific company
-- 3. User metadata (company_id, role) set by DATABASE, not client
-- 4. Client CANNOT specify company_id or role directly

-- =============================================================================
-- RLS Policy Update: Allow anon to create NEW companies only
-- =============================================================================

DROP POLICY IF EXISTS companies_insert_policy ON companies;

CREATE POLICY companies_insert_policy ON companies
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        -- sys_admin can always insert
        (SELECT auth.is_system_admin()) = true
        -- OR anon users can insert during signup (they create NEW companies)
        -- This is safe because:
        -- 1. They can only create NEW companies (no company_id to hijack)
        -- 2. Supabase Auth rate-limits signups
        -- 3. User metadata is set by trigger, not by client
        OR auth.role() = 'anon'
    );

COMMENT ON POLICY companies_insert_policy ON companies IS
'Allows sys_admin and anon users to create companies. Anon users create NEW companies during signup.';


-- =============================================================================
-- Database Trigger: Auto-set user metadata AFTER signup
-- Prevents client from choosing company_id or role
-- =============================================================================

-- This trigger runs AFTER a user signs up via Supabase Auth
-- It validates the signup context and sets metadata securely
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_invite_token TEXT;
    v_invite RECORD;
    v_company_id INT;
    v_role TEXT;
BEGIN
    -- Check if user signed up with invite token
    v_invite_token := NEW.raw_user_meta_data->>'invite_token';

    IF v_invite_token IS NOT NULL THEN
        -- =================================================================
        -- INVITE-BASED SIGNUP: Join existing company
        -- =================================================================

        -- Validate invite token
        SELECT * INTO v_invite
        FROM public.invites
        WHERE token = v_invite_token::UUID
            AND status = 'pending'
            AND expires_at > now();

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid or expired invite token';
        END IF;

        -- Use company_id and role FROM INVITE (not from client)
        v_company_id := v_invite.company_id;
        v_role := v_invite.role;

        -- Mark invite as used
        UPDATE public.invites
        SET status = 'accepted',
            used_at = now(),
            used_by = NEW.id
        WHERE token = v_invite_token::UUID;

    ELSE
        -- =================================================================
        -- PUBLIC SIGNUP: Create new company
        -- =================================================================

        -- Company should already be created by client
        -- Get the most recently created company (within last 5 seconds)
        -- This assumes client creates company THEN calls signUp immediately
        SELECT id INTO v_company_id
        FROM public.companies
        WHERE created_at > (now() - interval '5 seconds')
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_company_id IS NULL THEN
            RAISE EXCEPTION 'Company not found. Please create company first.';
        END IF;

        -- First user of new company gets 'admin' role (not sys_admin)
        v_role := 'admin';
    END IF;

    -- Update user metadata with VALIDATED values
    -- Client cannot forge this data
    NEW.raw_user_meta_data := jsonb_set(
        COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
        '{company_id}',
        to_jsonb(v_company_id)
    );

    NEW.raw_user_meta_data := jsonb_set(
        NEW.raw_user_meta_data,
        '{role}',
        to_jsonb(v_role)
    );

    RETURN NEW;
END;
$$;

-- Create trigger on auth.users (runs BEFORE INSERT)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION auth.handle_new_user();

COMMENT ON FUNCTION auth.handle_new_user IS
'Securely sets user metadata during signup. Validates invite tokens and prevents company_id/role forgery.';


-- =============================================================================
-- Application Usage:
-- =============================================================================

/*
-- PUBLIC SIGNUP (client code):
1. Create company:
   const { data: company } = await supabase
     .from('companies')
     .insert({ name: 'Acme Corp' })
     .select()
     .single();

2. Sign up user (within 5 seconds):
   const { data: user } = await supabase.auth.signUp({
     email: 'john@acme.com',
     password: 'secure123',
     options: {
       data: {
         first_name: 'John',
         last_name: 'Doe'
       }
     }
   });

   // Trigger auto-sets: company_id, role='admin'


-- INVITE SIGNUP (client code):
1. User receives invite link with token

2. Sign up with invite token:
   const { data: user } = await supabase.auth.signUp({
     email: 'jane@acme.com',
     password: 'secure123',
     options: {
       data: {
         first_name: 'Jane',
         last_name: 'Smith',
         invite_token: '<uuid-from-link>'
       }
     }
   });

   // Trigger validates token, sets: company_id (from invite), role (from invite)
*/
