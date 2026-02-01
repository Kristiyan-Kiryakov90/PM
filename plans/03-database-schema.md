# 03 - Database Schema & Migrations

> **Status**: 🟡 Pending
> **Phase**: Phase 1 - Setup & Authentication
> **Dependencies**: [02-supabase-setup.md](./02-supabase-setup.md)

---

## 1. Overview

### Feature Description
Create the complete database schema with **5 core tables** (companies, invites, projects, tasks, attachments) to support multi-tenant architecture with company-based isolation. Define relationships, add indexes for performance, and configure Row Level Security (RLS) policies for complete data isolation between companies.

### Goals
- Create companies table for multi-tenancy support
- Create invites table for secure invite-based registration
- Create projects table with company isolation
- Create tasks table with status, priority, assignments
- Create attachments table for file metadata
- Store user data in auth.users metadata (no separate users table)
- Define foreign key relationships with company isolation
- Add indexes for query performance
- Configure RLS policies for company-based data security

### User Value Proposition
Provides a secure, performant database foundation that enforces data integrity and access control at the database level.

### Prerequisites
- [x] [02-supabase-setup.md](./02-supabase-setup.md) - Supabase project created and configured

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** developer
**I want to** have a well-structured database schema
**So that** I can store and query project and task data efficiently

**As a** system administrator
**I want** Row Level Security enforced at the database level
**So that** users can only access data they're authorized to see

### Acceptance Criteria

- [ ] All 5 tables created successfully in Supabase (companies, invites, projects, tasks, attachments)
- [ ] Foreign key relationships enforced with company isolation
- [ ] Indexes created for performance (including company_id indexes)
- [ ] RLS enabled on all tables
- [ ] RLS policies configured for multi-tenancy (company-scoped)
- [ ] Migration SQL scripts saved in version control (005-009)
- [ ] Can query tables without errors
- [ ] Company isolation verified (users can only see their company's data)

### Definition of Done

- [ ] Migration scripts created and executed
- [ ] All tables visible in Supabase table editor
- [ ] RLS policies active and tested
- [ ] Documentation updated
- [ ] Changes committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Tables created | 5/5 |
| RLS policies configured | 100% (company-scoped) |
| Foreign key constraints | All relationships |
| Query performance | < 100ms for standard queries |
| Company isolation | 100% (no cross-company data leaks) |

---

## 3. Database Requirements

### Important: User Data Storage

**User profiles are stored in Supabase Auth, NOT in a separate table:**
- `user_metadata`: Stores profile data (full_name, avatar_url, company_id)
- `app_metadata`: Stores role (user, company_admin, system_admin) and company_id
- `auth.users.id`: Used as foreign key in invites/projects/tasks/attachments

**No separate users table needed!**

### Tables Needed (5 Total)

#### Table 1: companies (Multi-Tenancy)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique company identifier |
| name | VARCHAR(255) | NOT NULL, UNIQUE | Company name |
| domain | VARCHAR(255) | NULLABLE | Optional email domain for verification |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly identifier |
| status | VARCHAR(50) | DEFAULT 'active' | 'active', 'suspended', 'archived' |
| max_users | INTEGER | DEFAULT 50 | Maximum users allowed |
| settings | JSONB | DEFAULT '{}' | Company-specific settings |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Purpose**: Central table for multi-tenant architecture. All projects are scoped to a company.

**Indexes**: domain, slug, status, settings (GIN)

#### Table 2: invites (Invite-Based Registration)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique invite identifier |
| company_id | UUID | FK to companies(id), NOT NULL | Company for this invite |
| email | VARCHAR(255) | NOT NULL | Email address to invite |
| token | VARCHAR(64) | NOT NULL, UNIQUE | Secure random token |
| role | VARCHAR(50) | DEFAULT 'user' | 'user' or 'company_admin' |
| invited_by | UUID | FK to auth.users(id), NOT NULL | Admin who created invite |
| status | VARCHAR(50) | DEFAULT 'pending' | 'pending', 'accepted', 'expired', 'revoked' |
| expires_at | TIMESTAMP | NOT NULL | Expiration timestamp (7 days) |
| accepted_at | TIMESTAMP | NULLABLE | When invite was accepted |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Purpose**: Secure invite-based registration. Users can only register with a valid invite token.

**Indexes**: company_id, token, email, status, expires_at, (token, status) composite

**Constraints**: UNIQUE(email, company_id) - one invite per email per company

#### Table 3: projects

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique project identifier |
| name | VARCHAR(255) | NOT NULL | Project name |
| description | TEXT | | Project description |
| company_id | UUID | FK to companies(id), NOT NULL | Company that owns this project |
| owner_id | UUID | FK to auth.users(id), NOT NULL | Project creator/owner |
| status | VARCHAR(50) | DEFAULT 'active' | 'active', 'completed', 'archived' |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Company Isolation**: All projects belong to a company. Users can only see projects in their company.

**Indexes**: company_id, owner_id, status, created_at, (company_id, status) composite

#### Table 4: tasks

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique task identifier |
| title | VARCHAR(500) | NOT NULL | Task title |
| description | TEXT | | Detailed task description |
| status | VARCHAR(50) | DEFAULT 'todo' | 'todo', 'in_progress', 'done' |
| priority | VARCHAR(50) | DEFAULT 'medium' | 'low', 'medium', 'high', 'urgent' |
| due_date | DATE | | Task deadline |
| project_id | UUID | FK to projects(id) | Parent project (admin-assigned; nullable for normal users) |
| assignee_id | UUID | FK to auth.users(id) | Assigned user (nullable) |
| created_by | UUID | FK to auth.users(id), NOT NULL | Task creator |
| completed_at | TIMESTAMP | NULLABLE | Set when status transitions to 'done' (history/statistics) |
| deleted_at | TIMESTAMP | NULLABLE | Soft-delete marker; deleted tasks are hidden from active UI but kept for stats |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Company Isolation**: Tasks inherit company through project relationship.

**Indexes**: project_id, assignee_id, created_by, status, priority, due_date, created_at, (project_id, status) composite, (assignee_id, status) composite

#### Table 5: attachments

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique attachment identifier |
| task_id | UUID | FK to tasks(id), NOT NULL | Parent task |
| file_name | VARCHAR(255) | NOT NULL | Original file name |
| file_path | TEXT | NOT NULL | Supabase Storage path |
| file_url | TEXT | | Public URL (if applicable) |
| file_size | INTEGER | | File size in bytes |
| mime_type | VARCHAR(100) | | File MIME type |
| uploaded_by | UUID | FK to auth.users(id), NOT NULL | Uploader user ID |
| created_at | TIMESTAMP | DEFAULT NOW() | Upload timestamp |

**Company Isolation**: Attachments inherit company through task → project relationship.

**Indexes**: task_id, uploaded_by, created_at

### Relationships

**Company-based Multi-Tenancy:**
- `auth.users.user_metadata.company_id` → `companies.id` (stored in metadata)
- `invites.company_id` → `companies.id` (many-to-one)
- `projects.company_id` → `companies.id` (many-to-one)

**Project & Task Relationships:**
- `projects.owner_id` → `auth.users.id` (many-to-one)
- `tasks.project_id` → `projects.id` (many-to-one, nullable)
- `tasks.assignee_id` → `auth.users.id` (many-to-one, nullable)
- `tasks.created_by` → `auth.users.id` (many-to-one)
- `attachments.task_id` → `tasks.id` (many-to-one)
- `attachments.uploaded_by` → `auth.users.id` (many-to-one)

**Invite Relationships:**
- `invites.invited_by` → `auth.users.id` (many-to-one)

### Row Level Security (RLS) Policies

**Multi-Tenancy Approach**: All RLS policies enforce company-based isolation using helper functions.

**Helper Functions**:
- `auth.user_company_id()` - Returns current user's company_id from JWT metadata
- `auth.is_company_admin()` - Checks if user has company_admin or system_admin role
- `auth.is_system_admin()` - Checks if user has system_admin role

#### companies table RLS policies
- **SELECT**: Users can view their own company
- **INSERT**: Only system admins can create companies
- **UPDATE**: Company admins can update their own company
- **DELETE**: Only system admins can delete companies

#### invites table RLS policies
- **SELECT**: Company admins can view invites for their company
- **INSERT**: Company admins can create invites for their company
- **UPDATE**: Company admins can update invites (e.g., revoke)
- **DELETE**: Company admins can delete invites for their company

#### projects table RLS policies
- **SELECT**: Users can view projects in their company (`company_id = auth.user_company_id()`)
- **INSERT**: Company admins can create projects in their company
- **UPDATE**: Project owners can update their own projects
- **DELETE**: Project owners or company admins can delete projects

#### tasks table RLS policies
- **SELECT**: Users can view tasks in their company's projects
- **INSERT**: Users can create tasks in their company's projects
- **UPDATE**: Users can update tasks in their company (via project relationship)
- **DELETE**: Task creators or company admins can delete tasks

#### attachments table RLS policies
- **SELECT**: Users can view attachments in their company's tasks
- **INSERT**: Users can create attachments in their company's tasks
- **DELETE**: Attachment uploaders or company admins can delete attachments

**Security Note**: All policies check company membership via `auth.user_company_id()` to prevent cross-company data access.

### SQL Migration Scripts

**Files**:
- `backend/database/migrations/005_create_companies_table.sql` - Companies table + helper functions
- `backend/database/migrations/006_create_invites_table.sql` - Invites table
- `backend/database/migrations/007_add_company_to_projects.sql` - Add company_id to projects
- `backend/database/migrations/008_remove_users_table.sql` - Remove old users table
- `backend/database/migrations/009_update_all_rls_policies.sql` - Company-scoped RLS policies

---

## 4. Backend/Service Layer

**Not applicable for this spec** - This spec focuses on database schema only. Service modules will be created in subsequent specs.

---

## 5. Frontend/UI Implementation

**Not applicable for this spec** - No UI changes needed. Database schema is backend-only.

---

## 6. Security Considerations

### Row Level Security (RLS) Strategy

- **All tables have RLS enabled** - No data is accessible without proper authentication
- **Policy-based access control** - Database enforces authorization rules
- **Cascade deletes** - Referential integrity maintained automatically
- **Admin override** - Admins can access all data through RLS policies

### Data Integrity

- [ ] Foreign key constraints enforce relationships to auth.users
- [ ] CHECK constraints validate enum values (status, priority)
- [ ] NOT NULL constraints on required fields
- [ ] ON DELETE CASCADE for dependent data
- [ ] ON DELETE SET NULL for optional relationships (assignee_id)

### Performance Considerations

- [ ] Indexes on foreign keys for JOIN performance
- [ ] Indexes on frequently queried fields (status, priority, due_date, completed_at, deleted_at)
- [ ] Composite indexes may be added later based on query patterns

---

## 7. Implementation Steps

### Phase 1: Create Companies & Invites Tables
- [x] Create migration 005: companies table with helper functions
- [x] Create migration 006: invites table with token validation
- [x] Apply migrations to Supabase

### Phase 2: Update Projects for Multi-Tenancy
- [x] Create migration 007: add company_id to projects table
- [ ] Backfill existing projects with default company (data migration)

### Phase 3: Remove Old Users Table
- [x] Create migration 008: drop public.users table
- [ ] Migrate user data to auth.users metadata (if any existing data)

### Phase 4: Update RLS Policies
- [x] Create migration 009: company-scoped RLS policies for all tables
- [ ] Apply RLS policies migration
- [ ] Test company isolation (verify users can't see other company data)

### Phase 5: Backend Services
- [x] Create companies.service.js (CRUD operations)
- [x] Create invites.service.js (invite lifecycle management)
- [x] Update auth.service.js (add registerUserWithInvite)
- [ ] Create API routes for companies and invites

### Phase 6: Frontend Updates
- [ ] Install @supabase/supabase-js in frontend
- [ ] Create supabaseClient.js
- [ ] Update auth.js to use Supabase Auth
- [ ] Create profile page for profile management
- [ ] Update signup page for invite-based registration
- [ ] Add invite management UI to admin panel

---

## 9. Related Specs

### Dependencies (Must Complete First)

- [x] [02-supabase-setup.md](./02-supabase-setup.md) - Need Supabase project to create database schema

### Depends On This (Blocked Until Complete)

- [04-authentication.md](./04-authentication.md) - Needs auth.users setup with metadata
- [06-project-management.md](./06-project-management.md) - Needs projects table
- [07-task-management.md](./07-task-management.md) - Needs tasks table
- [08-task-assignment.md](./08-task-assignment.md) - Needs tasks.assignee_id field
- [09-file-storage.md](./09-file-storage.md) - Needs attachments table
- [10-admin-panel.md](./10-admin-panel.md) - Needs app_metadata.is_admin flag

### Related Features (Integration Points)

- All features depend on this schema
- RLS policies will be tested by all user operations
- Relationships enforce data integrity across all features

### Documentation References

- [Project Summary](../ai-docs/project-summary.md) - Database requirements
- [Security Practices](../ai-docs/security.md) - RLS best practices
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)

---

## Appendix

### Useful Resources

- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

### Notes & Considerations

- UUID used for all primary keys (better for distributed systems)
- TIMESTAMP WITH TIME ZONE for proper timezone handling
- VARCHAR lengths chosen based on common use cases
- CASCADE deletes simplify data cleanup
- RLS policies may need tuning based on performance testing

### Future Enhancements

- [ ] Email domain whitelisting (auto-approve users from company domain)
- [ ] Company subscription/billing tracking table
- [ ] Company branding settings (logo, colors, theme)
- [ ] Audit logging tables for change tracking (company-scoped)
- [ ] Comments table for task discussions
- [ ] Project_members junction table for explicit team management
- [ ] Task_tags for categorization
- [ ] Performance monitoring for slow queries
- [ ] Company data export for GDPR compliance
- [ ] SSO/SAML integration for enterprise customers
