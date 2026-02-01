# Project Technical Summary

## Architecture
- Frontend: Multi-page web app with JavaScript modules and Bootstrap UI.
- Backend: Express API server for auth, invites, companies, projects, tasks, and attachments.
- Data: Supabase Postgres with Row Level Security (RLS).
- Auth: Supabase Auth for user accounts and API access tokens.

## Roles
Every user has a role in auth app metadata:
- sys_admin
- admin
- user

Role checks are performed in:
- Backend route guards (Express)
- Database RLS helper functions
- Frontend UI gating

## Authentication Flow
- Registration:
  - Standard registration creates a user with role "user".
  - Invite registration assigns role from the invite (user or admin).
  - One-time bootstrap button creates a sys_admin user (used to start the system).
- Login:
  - Supabase Auth signs in and returns a session (access token + refresh token).
- Profile:
  - User profile data is stored in `auth.users` metadata (no public users table).

## Database Schema
Core tables:
- public.companies
  - id (uuid, pk)
  - name, slug, domain
  - status (active, suspended, archived)
  - max_users, settings (jsonb)
  - created_at, updated_at

- public.projects
  - id (uuid, pk)
  - name, description
  - owner_id (auth.users)
  - company_id (companies)
  - status (active, completed, archived)
  - created_at, updated_at

- public.tasks
  - id (uuid, pk)
  - title, description
  - status (todo, in_progress, done)
  - priority (low, medium, high, urgent)
  - due_date
  - project_id (projects)
  - assignee_id (auth.users)
  - created_by (auth.users)
  - created_at, updated_at

- public.attachments
  - id (uuid, pk)
  - task_id (tasks)
  - file_name, file_path, file_url
  - file_size, mime_type
  - uploaded_by (auth.users)
  - created_at

- public.invites
  - id (uuid, pk)
  - company_id (companies)
  - email
  - token (unique)
  - role (user, admin)
  - invited_by (auth.users)
  - status (pending, accepted, expired, revoked)
  - expires_at, accepted_at, created_at

## RLS and Helper Functions
RLS is enabled for company isolation and ownership checks.
Helper functions (auth schema) used in policies:
- auth.user_company_id()
- auth.is_company_admin()  -> true for admin or sys_admin
- auth.is_system_admin()   -> true for sys_admin

## Key API Endpoints
- Auth:
  - POST /api/auth/register
  - POST /api/auth/register-with-invite
  - POST /api/auth/login
  - POST /api/auth/logout
  - GET  /api/auth/me
  - POST /api/auth/create-admin (dev-only)
  - GET  /api/auth/admin-exists

- Invites:
  - GET  /api/invites/validate
  - POST /api/invites
  - GET  /api/invites
  - PATCH /api/invites/:id/revoke
  - POST /api/invites/:id/resend
  - DELETE /api/invites/:id

- Companies:
  - GET  /api/companies/me
  - POST /api/companies
  - GET  /api/companies
  - GET  /api/companies/:id
  - PATCH /api/companies/:id
  - DELETE /api/companies/:id
  - GET  /api/companies/:id/users
  - GET  /api/companies/:id/stats

## Frontend Pages
- index.html: Landing page + one-time admin bootstrap modal
- signup.html: Regular + Invite-based registration
- signin.html: Login
- dashboard.html: User overview
- projects.html: Project list and details
- tasks.html: Task list and status
- admin.html: Invite and company management
- profile.html: User profile and account settings
