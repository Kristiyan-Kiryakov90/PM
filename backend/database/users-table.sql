-- TaskFlow Users Table
-- Mirrors auth.users with profile data and role management
-- Following Supabase Postgres Best Practices v1.1.0

-- =============================================================================
-- USERS TABLE
-- Best Practice: Keep auth.users minimal, store profile data in public.users
-- Automatically synced via trigger when user signs up
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    -- Best Practice 4.1: Use UUID for id (matches auth.users.id)
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Profile fields
    email text NOT NULL UNIQUE,
    first_name text NOT NULL,
    last_name text NOT NULL,

    -- Role-based access
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('sys_admin', 'admin', 'user')),

    -- Multi-tenant isolation
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,

    -- Status management
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),

    -- Metadata
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    last_sign_in_at timestamptz,

    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_first_name_not_empty CHECK (trim(first_name) <> ''),
    CONSTRAINT users_last_name_not_empty CHECK (trim(last_name) <> ''),

    -- sys_admin users don't belong to a company
    CONSTRAINT users_company_required_for_non_sysadmin
        CHECK (role = 'sys_admin' OR company_id IS NOT NULL)
);

-- Best Practice 4.2: Index foreign key
CREATE INDEX IF NOT EXISTS users_company_id_idx ON users(company_id);

-- Best Practice 1.1: Index frequently queried columns
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Best Practice 1.3: Composite index for company + role queries
CREATE INDEX IF NOT EXISTS users_company_role_idx ON users(company_id, role);

-- Best Practice 1.5: Partial index for active users only
CREATE INDEX IF NOT EXISTS users_active_idx ON users(company_id, email)
WHERE status = 'active';

COMMENT ON TABLE users IS 'User profiles synced with auth.users';


-- =============================================================================
-- TRIGGER: Auto-create user profile when auth.users record is created
-- Best Practice: Sync public.users with auth.users automatically
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        first_name,
        last_name,
        role,
        company_id
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        (NEW.raw_user_meta_data->>'company_id')::bigint
    );
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates user profile when auth user is created';

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- TRIGGER: Sync last_sign_in_at from auth.users
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.users
    SET last_sign_in_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_login IS 'Syncs last_sign_in_at from auth.users';

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW
    WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
    EXECUTE FUNCTION public.handle_user_login();


-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =============================================================================

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- RLS POLICIES for users table
-- Best Practice 3.2 & 3.3: Multi-tenant isolation with optimized policies
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- SELECT: sys_admin sees all, users see their company's users
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        (SELECT public.is_system_admin()) = true
        OR company_id = (SELECT public.user_company_id())
        OR id = auth.uid() -- Users can always see their own profile
    );

-- INSERT: Only triggered automatically, but allow sys_admin direct inserts
CREATE POLICY users_insert_policy ON users
    FOR INSERT
    WITH CHECK (
        (SELECT public.is_system_admin()) = true
        OR id = auth.uid() -- Allow user to insert their own profile (signup)
    );

-- UPDATE: sys_admin can update any, admins can update their company users, users can update self
CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (
        (SELECT public.is_system_admin()) = true
        OR (
            company_id = (SELECT public.user_company_id())
            AND (SELECT public.is_company_admin()) = true
        )
        OR id = auth.uid() -- Users can update their own profile
    );

-- DELETE: Only sys_admin can delete users (soft delete recommended)
CREATE POLICY users_delete_policy ON users
    FOR DELETE
    USING (
        (SELECT public.is_system_admin()) = true
    );

COMMENT ON TABLE users IS 'RLS enabled: company-scoped access, users can view/edit own profile';


-- =============================================================================
-- HELPER FUNCTION: Get user's full name
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_full_name(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT first_name || ' ' || last_name
    FROM public.users
    WHERE id = user_id;
$$;

COMMENT ON FUNCTION public.user_full_name IS 'Returns user full name from user_id';


-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check trigger exists
/*
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
    AND event_object_table = 'users'
ORDER BY trigger_name;
*/

-- Check RLS policies
/*
SELECT
    policyname,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'users'
ORDER BY cmd;
*/
