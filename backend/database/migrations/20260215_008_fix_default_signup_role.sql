/**
 * Fix Default Signup Role - All New Users Should Be Admins
 * Date: 2026-02-15
 * Description: Change default role from 'user' to 'admin' for all new signups,
 *              regardless of whether they create a company or not.
 */

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
    v_role TEXT := 'admin';  -- CHANGED: Default role is now 'admin' (was 'user')
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

        -- User is admin of their new company (already set above)
    END IF;

    -- Return metadata for auth.signUp
    -- Note: All users are 'admin' by default now
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

COMMENT ON FUNCTION public.signup_with_optional_company IS
'Signup with optional company field. All new users are created as admin. Creates company if name is new and available.';
