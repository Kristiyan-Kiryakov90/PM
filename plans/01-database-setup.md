# Plan 01: Database Setup

## Objective
Create database schema, RLS policies, and helper functions for multi-tenant architecture.

## What's Needed

**Files:**
- `backend/database/schema.sql` - 5 tables (companies, projects, tasks, attachments, invites)
- `backend/database/helper-functions.sql` - Auth helper functions for RLS
- `backend/database/rls-policies.sql` - Multi-tenant isolation policies

**Tables:**
- Companies - Multi-tenant container with status and settings
- Projects - Linked to companies and owners
- Tasks - With status, priority, assignees
- Attachments - File metadata for tasks
- Invites - Token-based invitations with expiration

**Helper Functions:**
- `auth.user_company_id()` - Extract company ID from JWT
- `auth.is_company_admin()` - Check admin/sys_admin role
- `auth.is_system_admin()` - Check sys_admin only
- `auth.get_user_role()` - Get current user role

**RLS Policies:**
- Isolate companies from each other
- sys_admin sees all companies
- Users see only their company's data
- Enforce company_id filtering on all tables

**Storage:**
- Create "attachments" bucket (public access)

## Testing
- Verify all 5 tables exist with RLS enabled
- Verify helper functions callable
- Verify storage bucket created
- Test RLS isolation (after auth implemented)

## Dependencies
None - first step
