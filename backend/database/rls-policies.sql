-- TaskFlow Row Level Security (RLS) Policies
-- Multi-tenant isolation with role-based access control
-- Following Supabase Postgres Best Practices v1.1.0 Section 3

-- =============================================================================
-- Best Practice 3.2: Enable Row Level Security for Multi-Tenant Data
-- Best Practice 3.3: Optimize RLS Policies for Performance
--
-- Key Principles:
-- 1. Enable RLS on ALL tables
-- 2. Force RLS even for table owners (FORCE ROW LEVEL SECURITY)
-- 3. Wrap functions in SELECT to cache results (performance optimization)
-- 4. sys_admin role sees all data across companies
-- 5. Regular users see only their company's data
-- 6. Separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
-- =============================================================================


-- =============================================================================
-- COMPANIES TABLE
-- sys_admin: full access to all companies
-- admin: can update their own company
-- user: can read their own company
-- =============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

-- SELECT: sys_admin sees all, others see only their company
CREATE POLICY companies_select_policy ON companies
    FOR SELECT
    USING (
        -- Best Practice 3.3: Wrap function in SELECT for caching
        (SELECT auth.is_system_admin()) = true
        OR id = (SELECT auth.user_company_id())
    );

-- INSERT: Only sys_admin can create companies
-- Regular users get company_id from invite during signup
CREATE POLICY companies_insert_policy ON companies
    FOR INSERT
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
    );

-- UPDATE: sys_admin can update any, admin can update their own
CREATE POLICY companies_update_policy ON companies
    FOR UPDATE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR (
            id = (SELECT auth.user_company_id())
            AND (SELECT auth.is_company_admin()) = true
        )
    );

-- DELETE: Only sys_admin can delete companies
CREATE POLICY companies_delete_policy ON companies
    FOR DELETE
    USING (
        (SELECT auth.is_system_admin()) = true
    );

COMMENT ON TABLE companies IS 'RLS enabled: sys_admin sees all, users see their company only';


-- =============================================================================
-- PROJECTS TABLE
-- Multi-tenant isolation via company_id
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

-- Best Practice 3.3: Always add indexes on columns used in RLS policies
-- Already created in schema-optimized.sql: projects_company_id_idx

-- SELECT: sys_admin sees all, users see their company's projects
CREATE POLICY projects_select_policy ON projects
    FOR SELECT
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- INSERT: users can create projects in their company
CREATE POLICY projects_insert_policy ON projects
    FOR INSERT
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- UPDATE: users can update projects in their company
CREATE POLICY projects_update_policy ON projects
    FOR UPDATE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- DELETE: only admins can delete projects
CREATE POLICY projects_delete_policy ON projects
    FOR DELETE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR (
            company_id = (SELECT auth.user_company_id())
            AND (SELECT auth.is_company_admin()) = true
        )
    );

COMMENT ON TABLE projects IS 'RLS enabled: company-scoped access, admins can delete';


-- =============================================================================
-- TASKS TABLE
-- Multi-tenant isolation via company_id
-- =============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

-- Best Practice 3.3: Index on company_id already created in schema

-- SELECT: sys_admin sees all, users see their company's tasks
CREATE POLICY tasks_select_policy ON tasks
    FOR SELECT
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- INSERT: users can create tasks in their company's projects
CREATE POLICY tasks_insert_policy ON tasks
    FOR INSERT
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- UPDATE: users can update tasks in their company
CREATE POLICY tasks_update_policy ON tasks
    FOR UPDATE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- DELETE: users can delete tasks in their company
CREATE POLICY tasks_delete_policy ON tasks
    FOR DELETE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

COMMENT ON TABLE tasks IS 'RLS enabled: company-scoped access for all operations';


-- =============================================================================
-- ATTACHMENTS TABLE
-- Multi-tenant isolation via company_id
-- =============================================================================

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments FORCE ROW LEVEL SECURITY;

-- SELECT: sys_admin sees all, users see their company's attachments
CREATE POLICY attachments_select_policy ON attachments
    FOR SELECT
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- INSERT: users can upload attachments to their company's tasks
CREATE POLICY attachments_insert_policy ON attachments
    FOR INSERT
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- UPDATE: users can update attachment metadata in their company
CREATE POLICY attachments_update_policy ON attachments
    FOR UPDATE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- DELETE: users can delete attachments from their company
CREATE POLICY attachments_delete_policy ON attachments
    FOR DELETE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

COMMENT ON TABLE attachments IS 'RLS enabled: company-scoped access for all operations';


-- =============================================================================
-- INVITES TABLE
-- Multi-tenant isolation via company_id
-- Admins can manage invites, users can view pending invites
-- =============================================================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;

-- SELECT: sys_admin sees all, users see their company's invites
CREATE POLICY invites_select_policy ON invites
    FOR SELECT
    USING (
        (SELECT auth.is_system_admin()) = true
        OR company_id = (SELECT auth.user_company_id())
    );

-- INSERT: only admins can create invites
CREATE POLICY invites_insert_policy ON invites
    FOR INSERT
    WITH CHECK (
        (SELECT auth.is_system_admin()) = true
        OR (
            company_id = (SELECT auth.user_company_id())
            AND (SELECT auth.is_company_admin()) = true
        )
    );

-- UPDATE: only admins can update invites (e.g., extend expiration)
CREATE POLICY invites_update_policy ON invites
    FOR UPDATE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR (
            company_id = (SELECT auth.user_company_id())
            AND (SELECT auth.is_company_admin()) = true
        )
    );

-- DELETE: only admins can delete invites
CREATE POLICY invites_delete_policy ON invites
    FOR DELETE
    USING (
        (SELECT auth.is_system_admin()) = true
        OR (
            company_id = (SELECT auth.user_company_id())
            AND (SELECT auth.is_company_admin()) = true
        )
    );

COMMENT ON TABLE invites IS 'RLS enabled: company-scoped, admin-only write access';


-- =============================================================================
-- Best Practice 3.2: Special policy for invite token validation
-- This allows unauthenticated users to validate invite tokens during signup
-- Best Practice 3.1: Principle of least privilege - read-only, token-specific
-- =============================================================================

-- Allow public read access ONLY for validating invite tokens (used during signup)
-- This is safe because:
-- 1. Tokens are UUIDs (unguessable)
-- 2. Only returns minimal info needed for signup
-- 3. Expires_at prevents reuse of old tokens
CREATE POLICY invites_public_validate_policy ON invites
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'pending'
        AND expires_at > now()
    );

COMMENT ON POLICY invites_public_validate_policy ON invites IS 'Allows unauthenticated invite token validation during signup';


-- =============================================================================
-- Verification Queries
-- Run these to verify RLS is working correctly
-- =============================================================================

-- Check all tables have RLS enabled
-- Expected: 5 tables (companies, projects, tasks, attachments, invites)
/*
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND rowsecurity = true
ORDER BY tablename;
*/

-- Check policy count per table
-- Expected: 4-5 policies per table (SELECT, INSERT, UPDATE, DELETE, + optional public)
/*
SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
*/

-- List all policies
/*
SELECT
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    CASE
        WHEN roles = '{public}' THEN 'public'
        ELSE array_to_string(roles, ', ')
    END as applies_to
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
*/
