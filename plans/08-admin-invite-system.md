# Plan 08: Admin & Invite System

## Objective
Implement admin panel with invite management and company settings.

## What's Needed

**Files:**
- `frontend/src/js/services/invite-service.js` - Invite CRUD operations
- `frontend/src/js/pages/admin.js` - Admin panel logic
- `frontend/public/admin.html` - Complete UI with tabs
- `frontend/src/css/admin.css` - Admin panel styles

**Functionality:**

**Invite Service:**
- createInvite - Generate token, set expiration (7 days), create record
- getInvites - List invites for company
- revokeInvite - Set status to 'revoked'

**Admin Panel:**
- Route guard: requireRole(['admin', 'sys_admin'])
- Tab 1: Invites Management
  - Create invite form (email, role: user or admin)
  - Display invite URL with copy button
  - Invites table (email, role, status, created date, actions)
  - Revoke invite action
  - Filter by status
- Tab 2: Company Settings
  - Edit company name, settings
  - View company stats
- Tab 3: All Companies (sys_admin only)
  - List all companies
  - View/manage company statuses

**Invite URL:**
- Format: `http://domain/signup.html?token={uuid}`
- Admin copies and shares manually (no email sending)

**Token Generation:**
- Use crypto.randomUUID() for secure tokens
- 7-day expiration from creation
- Store in invites table

## Testing
- Admin can access admin panel
- Regular users cannot access admin panel
- Can create invite with generated URL
- Invite URL format correct
- Can copy invite URL
- Can revoke invite
- Revoked invites cannot be used
- sys_admin sees "All Companies" tab
- Regular admin does not see "All Companies" tab
- Multi-tenant isolation (admin sees only own company's invites)

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 04 (Navigation & Routing)
