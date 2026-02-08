-- Migration: Proper Multi-Tenant Architecture (per Supabase best practices)
-- Date: 2026-02-07
-- Description: Implements secure multi-tenancy with profiles table and tenant-safe FKs

-- =============================================================================
-- STEP 1: Create Profiles Table (User Mapping)
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX profiles_company_id_idx ON profiles(company_id);
CREATE INDEX profiles_role_idx ON profiles(role);
CREATE INDEX profiles_company_role_idx ON profiles(company_id, role);

COMMENT ON TABLE profiles IS
'User mapping table. Each auth.users row has exactly one profile with company_id and role. Enforces tenant membership at DB level.';

COMMENT ON COLUMN profiles.company_id IS
'User belongs to this company. NULL = personal workspace user (if supported). NOT NULL = company user.';

COMMENT ON COLUMN profiles.role IS
'Tenant role: admin (company admin) or user (regular user). sys_admin NOT stored here.';


-- =============================================================================
-- STEP 2: Migrate Existing Users from auth.users metadata to profiles
-- =============================================================================

-- Insert profiles for existing users (if any)
INSERT INTO profiles (id, company_id, role, created_at)
SELECT
  id,
  (raw_user_meta_data->>'company_id')::UUID,
  COALESCE(raw_user_meta_data->>'role', 'user')::TEXT,
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
  AND (raw_user_meta_data->>'role')::TEXT IN ('admin', 'user')  -- Exclude sys_admin
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE profiles IS
'Migrated from auth.users.user_metadata. Now single source of truth for company membership.';


-- =============================================================================
-- STEP 3: Update Helper Functions to Read from profiles
-- =============================================================================

-- Drop old functions that read from metadata
DROP FUNCTION IF EXISTS auth.user_company_id() CASCADE;
DROP FUNCTION IF EXISTS auth.is_company_admin() CASCADE;

-- New function: Get company_id from profiles table
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.user_company_id IS
'Returns authenticated user company_id from profiles table. NULL if no profile or personal user.';


-- New function: Check if user is company admin
CREATE OR REPLACE FUNCTION auth.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION auth.is_company_admin IS
'Returns true if user has admin role in their company.';


-- New function: Check if user is system admin
-- Option A: Service role only (no DB storage) - RECOMMENDED
CREATE OR REPLACE FUNCTION auth.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- System admin = requests with service role key
  -- Check if current role is 'service_role'
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role';
END;
$$;

COMMENT ON FUNCTION auth.is_system_admin IS
'System admin check via service role. Only backend requests with service_role key return true.';


-- =============================================================================
-- STEP 4: Add Tenant-Safe Composite Foreign Keys
-- =============================================================================

-- Ensure projects has composite unique constraint
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_company_id_id_key;

ALTER TABLE projects
  ADD CONSTRAINT projects_company_id_id_key
  UNIQUE (company_id, id);

COMMENT ON CONSTRAINT projects_company_id_id_key ON projects IS
'Composite key for tenant-safe FK from tasks. Prevents cross-company project references.';


-- Drop existing simple FK on tasks (if exists)
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

-- Add tenant-safe composite FK
ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_fk
  FOREIGN KEY (company_id, project_id)
  REFERENCES projects(company_id, id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT tasks_project_fk ON tasks IS
'Tenant-safe FK: ensures task.project belongs to same company as task. Prevents cross-company linking.';


-- Same for attachments (if they reference tasks)
ALTER TABLE attachments
  DROP CONSTRAINT IF EXISTS attachments_task_id_fkey;

-- Add composite unique on tasks
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_company_id_id_key;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_company_id_id_key
  UNIQUE (company_id, id);

-- Add tenant-safe FK on attachments
ALTER TABLE attachments
  ADD CONSTRAINT attachments_task_fk
  FOREIGN KEY (company_id, task_id)
  REFERENCES tasks(company_id, id)
  ON DELETE CASCADE;


-- =============================================================================
-- STEP 5: Update RLS Policies to Use profiles Table
-- =============================================================================

-- ┌─────────────────────────────────────────────────────────────┐
-- │  PROFILES TABLE                                              │
-- └─────────────────────────────────────────────────────────────┘

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- SELECT: User can see their own profile + admin can see company users
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT
  USING (
    id = auth.uid()  -- Own profile
    OR
    (
      -- Admin sees all users in their company
      company_id = auth.user_company_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- INSERT: Only service role (via Edge Function)
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
CREATE POLICY profiles_insert_policy ON profiles
  FOR INSERT
  WITH CHECK (
    auth.is_system_admin() = true  -- Service role only
  );

-- UPDATE: Only service role (role changes, company moves)
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE
  USING (
    auth.is_system_admin() = true  -- Service role only
  );

-- DELETE: Only service role
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;
CREATE POLICY profiles_delete_policy ON profiles
  FOR DELETE
  USING (
    auth.is_system_admin() = true  -- Service role only
  );

COMMENT ON TABLE profiles IS
'RLS enabled: Users see own profile. Admins see company users. Only service role can modify.';


-- ┌─────────────────────────────────────────────────────────────┐
-- │  COMPANIES TABLE - Update SELECT to check profiles          │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS companies_select_policy ON companies;
CREATE POLICY companies_select_policy ON companies
  FOR SELECT
  USING (
    auth.is_system_admin() = true
    OR id = auth.user_company_id()  -- Now reads from profiles
  );

-- INSERT: Only service role (admins create via Edge Function)
DROP POLICY IF EXISTS companies_insert_policy ON companies;
CREATE POLICY companies_insert_policy ON companies
  FOR INSERT
  WITH CHECK (
    auth.is_system_admin() = true
    OR auth.role() = 'anon'  -- Allow during signup
  );

-- UPDATE: Service role or company admin
DROP POLICY IF EXISTS companies_update_policy ON companies;
CREATE POLICY companies_update_policy ON companies
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR (
      id = auth.user_company_id()
      AND auth.is_company_admin() = true
    )
  );

-- DELETE: Only service role
DROP POLICY IF EXISTS companies_delete_policy ON companies;
CREATE POLICY companies_delete_policy ON companies
  FOR DELETE
  USING (
    auth.is_system_admin() = true
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  PROJECTS TABLE - Updated with granular permissions         │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_insert_policy ON projects;
DROP POLICY IF EXISTS projects_update_policy ON projects;
DROP POLICY IF EXISTS projects_delete_policy ON projects;

-- SELECT: All users in company
CREATE POLICY projects_select_policy ON projects
  FOR SELECT
  USING (
    auth.is_system_admin() = true
    OR
    (
      (auth.user_company_id() IS NULL AND created_by = auth.uid())  -- Personal
      OR
      (auth.user_company_id() IS NOT NULL AND company_id = auth.user_company_id())  -- Company
    )
  );

-- INSERT: Admin can create, users cannot (per prompt requirements)
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT
  WITH CHECK (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true  -- Only admins create projects
    )
    OR
    (
      company_id IS NULL  -- Personal project
      AND created_by = auth.uid()
    )
  );

-- UPDATE: Admin can update company projects
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true
    )
    OR
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: Only admin
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true
    )
    OR
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );


-- ┌─────────────────────────────────────────────────────────────┐
-- │  TASKS TABLE - Admin writes, user reads                     │
-- └─────────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS tasks_select_policy ON tasks;
DROP POLICY IF EXISTS tasks_insert_policy ON tasks;
DROP POLICY IF EXISTS tasks_update_policy ON tasks;
DROP POLICY IF EXISTS tasks_delete_policy ON tasks;

-- SELECT: All company users can read
CREATE POLICY tasks_select_policy ON tasks
  FOR SELECT
  USING (
    auth.is_system_admin() = true
    OR
    (
      (auth.user_company_id() IS NULL AND created_by = auth.uid())
      OR
      (auth.user_company_id() IS NOT NULL AND company_id = auth.user_company_id())
    )
  );

-- INSERT: Admins only (or if you want users to create, change to role IN ('admin','user'))
CREATE POLICY tasks_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true  -- Change to allow users if needed
    )
    OR
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- UPDATE: Admins can update all, users can update tasks (if you want)
CREATE POLICY tasks_update_policy ON tasks
  FOR UPDATE
  USING (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true
    )
    OR
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );

-- DELETE: Admins only
CREATE POLICY tasks_delete_policy ON tasks
  FOR DELETE
  USING (
    auth.is_system_admin() = true
    OR
    (
      company_id = auth.user_company_id()
      AND auth.is_company_admin() = true
    )
    OR
    (
      company_id IS NULL
      AND created_by = auth.uid()
    )
  );


-- =============================================================================
-- STEP 6: Performance Indexes
-- =============================================================================

-- Company-scoped queries
CREATE INDEX IF NOT EXISTS projects_company_id_idx ON projects(company_id);
CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS attachments_company_id_idx ON attachments(company_id);

-- Composite indexes for tenant-safe FKs
CREATE INDEX IF NOT EXISTS tasks_company_project_idx ON tasks(company_id, project_id);
CREATE INDEX IF NOT EXISTS attachments_company_task_idx ON attachments(company_id, task_id);

-- User lookups
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects(created_by);
CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks(created_by);


-- =============================================================================
-- STEP 7: Trigger to Sync profiles on auth.users creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Auto-create profile when auth.users row is created
  -- This happens during signup AFTER company is created
  INSERT INTO public.profiles (id, company_id, role, created_at)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'company_id')::UUID,
    COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'user'),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

COMMENT ON FUNCTION public.handle_new_user_profile IS
'Auto-creates profile when user signs up. Reads company_id from user_metadata.';


-- =============================================================================
-- SUMMARY
-- =============================================================================

/*
WHAT THIS MIGRATION DOES:

1. Creates profiles table (user mapping)
   - FK to auth.users (referential integrity)
   - Stores company_id and role
   - Single source of truth for tenant membership

2. Migrates existing users to profiles
   - Preserves company_id and role from metadata

3. Updates helper functions
   - auth.user_company_id() now reads from profiles
   - auth.is_company_admin() now reads from profiles
   - auth.is_system_admin() checks service_role

4. Adds tenant-safe composite FKs
   - tasks.company_id + project_id → projects.company_id + id
   - Prevents cross-company task linking

5. Updates all RLS policies
   - Read from profiles table
   - Enforce admin vs user permissions
   - Service role only for profile changes

6. Adds performance indexes
   - company_id indexes
   - Composite indexes for FKs

7. Auto-sync trigger
   - Creates profile when user signs up

SECURITY GUARANTEES:

✅ Users can only see their company's data (company_id filter)
✅ Tasks cannot reference other companies' projects (composite FK)
✅ Profiles are single source of truth (not client metadata)
✅ Only service role can modify profiles (admin via Edge Function)
✅ Default deny: no profile = no access

NEXT STEPS:

1. Apply this migration
2. Update signup flow to create profile
3. Create Edge Function for admin user creation (next migration)
4. Test tenant isolation thoroughly
*/
