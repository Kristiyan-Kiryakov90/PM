-- Migration: Final Optional Company Model
-- Date: 2026-02-07
-- Description: Company field optional on signup, prevents duplicate company names

-- =============================================================================
-- STEP 1: Add Unique Constraint on Company Name (Case-Insensitive)
-- =============================================================================

-- Drop existing index if any
DROP INDEX IF EXISTS companies_name_unique_idx;

-- Create unique index (case-insensitive)
CREATE UNIQUE INDEX companies_name_unique_idx
  ON companies (LOWER(TRIM(name)));

COMMENT ON INDEX companies_name_unique_idx IS
'Prevents duplicate company names (case-insensitive). Blocks unauthorized signup to existing companies.';


-- =============================================================================
-- STEP 2: Signup Function with Duplicate Prevention
-- =============================================================================

CREATE OR REPLACE FUNCTION public.signup_with_optional_company(
    p_company_name TEXT,
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id INT := NULL;
    v_role TEXT := 'user';
    v_existing_company INT;
    v_result JSON;
    v_trimmed_name TEXT;
BEGIN
    -- Trim company name
    v_trimmed_name := TRIM(p_company_name);

    -- If company name provided (not empty)
    IF v_trimmed_name IS NOT NULL AND v_trimmed_name != '' THEN

        -- Check if company already exists (case-insensitive)
        SELECT id INTO v_existing_company
        FROM companies
        WHERE LOWER(name) = LOWER(v_trimmed_name);

        IF v_existing_company IS NOT NULL THEN
            -- Company exists - REJECT signup
            RAISE EXCEPTION 'Company "%" already exists. Contact your company admin for an invite.', v_trimmed_name;
        END IF;

        -- Company doesn't exist - create it
        INSERT INTO companies (name, created_at, updated_at)
        VALUES (v_trimmed_name, now(), now())
        RETURNING id INTO v_company_id;

        -- User becomes admin of their new company
        v_role := 'admin';
    END IF;

    -- Return metadata for auth.signUp
    v_result := json_build_object(
        'success', true,
        'company_id', v_company_id,
        'role', v_role,
        'workspace_type', CASE
            WHEN v_company_id IS NOT NULL THEN 'company'
            ELSE 'personal'
        END,
        'message', CASE
            WHEN v_company_id IS NOT NULL THEN format('Company "%s" created successfully', v_trimmed_name)
            ELSE 'Personal workspace created'
        END
    );

    RETURN v_result;

EXCEPTION
    WHEN unique_violation THEN
        -- Race condition: someone else just created same company
        RAISE EXCEPTION 'Company "%" was just created by another user. Please try a different name.', v_trimmed_name;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Signup failed: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.signup_with_optional_company TO anon, authenticated;

COMMENT ON FUNCTION public.signup_with_optional_company IS
'Signup with optional company field. Creates company if name is new and available. Rejects if company name already exists (prevents hijacking).';


-- =============================================================================
-- STEP 3: Rollback Function (in case signup fails after company creation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rollback_company_creation(
    p_company_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Delete company if no users are associated yet
    -- This is called when auth.signUp fails after company was created
    DELETE FROM companies
    WHERE id = p_company_id
      AND created_at > (now() - interval '5 minutes')  -- Safety: only recent
      AND NOT EXISTS (
          -- No users have this company_id
          SELECT 1 FROM auth.users
          WHERE (raw_user_meta_data->>'company_id')::INT = p_company_id
      );

    v_result := json_build_object(
        'success', true,
        'message', 'Company cleaned up'
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_company_creation TO anon, authenticated;

COMMENT ON FUNCTION public.rollback_company_creation IS
'Cleans up company if user signup fails. Only deletes recent companies with no users.';


-- =============================================================================
-- STEP 4: Helper Function to Check Company Availability
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_company_name_available(
    p_company_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- Check if company name exists (case-insensitive)
    SELECT EXISTS (
        SELECT 1 FROM companies
        WHERE LOWER(name) = LOWER(TRIM(p_company_name))
    ) INTO v_exists;

    v_result := json_build_object(
        'available', NOT v_exists,
        'message', CASE
            WHEN v_exists THEN format('Company name "%s" is already taken', TRIM(p_company_name))
            ELSE format('Company name "%s" is available', TRIM(p_company_name))
        END
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_company_name_available TO anon, authenticated;

COMMENT ON FUNCTION public.check_company_name_available IS
'Checks if a company name is available (for real-time validation during signup)';


-- =============================================================================
-- STEP 5: Update Companies RLS - Keep Existing Policies
-- =============================================================================

-- RLS policies remain the same from previous migrations
-- SELECT: sys_admin sees all, users see their company
-- INSERT: sys_admin, anon, authenticated can insert (validated by function)
-- UPDATE: sys_admin or company admin
-- DELETE: sys_admin only


-- =============================================================================
-- STEP 6: Ensure Projects/Tasks/Attachments Have Nullable company_id
-- =============================================================================

-- Already done in migration 008, but verify
DO $$
BEGIN
    -- Check if company_id is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'company_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE projects ALTER COLUMN company_id DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'company_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE tasks ALTER COLUMN company_id DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'company_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE attachments ALTER COLUMN company_id DROP NOT NULL;
    END IF;
END $$;


-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check unique index exists
/*
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'companies'
  AND indexname = 'companies_name_unique_idx';
*/

-- Test company name availability
/*
SELECT public.check_company_name_available('Test Company');
SELECT public.check_company_name_available('test company');  -- Same (case-insensitive)
*/

-- Test signup function
/*
SELECT public.signup_with_optional_company('My New Company', 'test@example.com', 'Test', 'User');
SELECT public.signup_with_optional_company('My New Company', 'test2@example.com', 'Test', 'User');  -- Should fail
SELECT public.signup_with_optional_company(NULL, 'personal@example.com', 'Personal', 'User');  -- Personal workspace
*/
