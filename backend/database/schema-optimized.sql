-- TaskFlow Database Schema (Optimized for Performance)
-- Multi-tenant task and project management system
-- Following Supabase Postgres Best Practices v1.1.0

-- =============================================================================
-- Best Practice 4.1: Use appropriate data types
-- - bigint IDENTITY for primary keys (SQL-standard, no fragmentation)
-- - TEXT instead of VARCHAR (no arbitrary limits, same performance)
-- - timestamptz for all timestamps (timezone-aware)
-- - numeric for precise decimals, boolean for flags
-- =============================================================================

-- Companies table (multi-tenant isolation)
CREATE TABLE IF NOT EXISTS companies (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT companies_name_not_empty CHECK (trim(name) <> '')
);

-- Best Practice 1.5: Add comment for documentation
COMMENT ON TABLE companies IS 'Multi-tenant container for isolating company data';


-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    created_by uuid NOT NULL, -- References auth.users(id)
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT projects_name_not_empty CHECK (trim(name) <> '')
);

-- Best Practice 4.2: Index foreign key columns (critical for JOINs and CASCADE)
CREATE INDEX IF NOT EXISTS projects_company_id_idx ON projects(company_id);

-- Best Practice 1.3: Composite index for multi-column queries
-- Common query: WHERE company_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS projects_company_status_idx ON projects(company_id, status);

-- Best Practice 1.5: Partial index for active projects only (smaller, faster)
CREATE INDEX IF NOT EXISTS projects_active_idx ON projects(company_id, created_at DESC)
WHERE status = 'active';

COMMENT ON TABLE projects IS 'Projects within a company';


-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to uuid, -- References auth.users(id)
    created_by uuid NOT NULL, -- References auth.users(id)
    due_date timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT tasks_title_not_empty CHECK (trim(title) <> '')
);

-- Best Practice 4.2: Index all foreign key columns
CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);

-- Best Practice 1.3: Composite indexes for common multi-column queries
-- Query: WHERE company_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS tasks_company_status_idx ON tasks(company_id, status);

-- Query: WHERE project_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks(project_id, status);

-- Query: WHERE assigned_to = ? AND status != 'done'
CREATE INDEX IF NOT EXISTS tasks_assigned_active_idx ON tasks(assigned_to, status)
WHERE status != 'done';

-- Best Practice 1.5: Partial index for pending tasks (most frequently queried)
CREATE INDEX IF NOT EXISTS tasks_pending_idx ON tasks(company_id, priority, due_date)
WHERE status IN ('todo', 'in_progress');

-- Best Practice 1.4: Covering index for task list queries (includes SELECT columns)
CREATE INDEX IF NOT EXISTS tasks_list_idx ON tasks(project_id, status)
INCLUDE (title, priority, assigned_to, due_date);

COMMENT ON TABLE tasks IS 'Tasks within projects';


-- Attachments table (for file uploads)
CREATE TABLE IF NOT EXISTS attachments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint NOT NULL, -- Use bigint for file sizes (supports files > 2GB)
    mime_type text,
    uploaded_by uuid NOT NULL, -- References auth.users(id)
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT attachments_file_name_not_empty CHECK (trim(file_name) <> ''),
    CONSTRAINT attachments_file_path_not_empty CHECK (trim(file_path) <> ''),
    CONSTRAINT attachments_file_size_positive CHECK (file_size > 0)
);

-- Best Practice 4.2: Index foreign keys
CREATE INDEX IF NOT EXISTS attachments_company_id_idx ON attachments(company_id);
CREATE INDEX IF NOT EXISTS attachments_task_id_idx ON attachments(task_id);

-- Composite index for common query: get all attachments for a task
CREATE INDEX IF NOT EXISTS attachments_task_created_idx ON attachments(task_id, created_at DESC);

COMMENT ON TABLE attachments IS 'File attachments for tasks';


-- Invites table (for user invitations)
CREATE TABLE IF NOT EXISTS invites (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'user')),
    token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- UUID OK for tokens (not sequential lookups)
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    invited_by uuid NOT NULL, -- References auth.users(id)
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    used_at timestamptz,
    CONSTRAINT invites_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT invites_expires_future CHECK (expires_at > created_at)
);

-- Best Practice 4.2: Index foreign keys
CREATE INDEX IF NOT EXISTS invites_company_id_idx ON invites(company_id);

-- Best Practice 1.1: Index columns used in WHERE clauses
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites(token) WHERE status = 'pending';

-- Best Practice 1.5: Partial index for pending invites only (frequently queried)
CREATE INDEX IF NOT EXISTS invites_pending_idx ON invites(company_id, email, status)
WHERE status = 'pending';

-- Composite index for lookup by email and company
CREATE INDEX IF NOT EXISTS invites_email_company_idx ON invites(email, company_id);

COMMENT ON TABLE invites IS 'User invitation tokens';


-- =============================================================================
-- Best Practice 7.2: Maintain table statistics with VACUUM and ANALYZE
-- Trigger function to automatically update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates updated_at timestamp on row modification';

-- Apply updated_at triggers to tables with updated_at column
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- Best Practice 7.1: Enable pg_stat_statements for query analysis
-- Already enabled in Supabase by default
-- =============================================================================

-- Best Practice 2.1: Configure idle connection timeouts
-- Note: These should be set at database level, not in migrations
-- ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
-- ALTER SYSTEM SET idle_session_timeout = '10min';
