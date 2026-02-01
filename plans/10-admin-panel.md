# 10 - Admin Panel & User Management

> **Status**: 🟡 Pending
> **Phase**: Phase 4 - File Storage & Admin
> **Dependencies**: [04-authentication.md](./04-authentication.md)

---

## 1. Overview

### Feature Description
Admin-only panel for managing users, viewing all projects, and accessing system-wide statistics. Admins can change user roles, view all data, and manage the system.

### Goals
- Create admin-only page with role-based access
- Display all users with role management
- Show system statistics (total users, projects, tasks)
- Allow admins to view all projects and tasks
- Enable role changes (user ↔ admin)
- Admin navigation menu item (only visible to admins)

### User Value Proposition
Provides system administrators with tools to manage users and monitor overall system health and usage.

### Prerequisites
- [x] [04-authentication.md](./04-authentication.md) - Auth system with role field

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As an** admin
**I want to** view all users in the system
**So that** I can manage user accounts

**As an** admin
**I want to** change user roles
**So that** I can grant or revoke admin privileges

**As an** admin
**I want to** see system-wide statistics
**So that** I can monitor system usage

**As an** admin
**I want to** view all projects and tasks
**So that** I can oversee all work in the system

### Acceptance Criteria

- [ ] Admin panel only accessible to users with role='admin'
- [ ] Regular users redirected if they try to access admin panel
- [ ] Admin menu link only visible to admins
- [ ] User list shows all users with email, name, role, join date
- [ ] Admins can change user roles
- [ ] System statistics display: total users, projects, tasks
- [ ] Admins can view all projects (not just their own)
- [ ] Admins can view all tasks (not just assigned)

### Definition of Done

- [ ] Admin page created with role guard
- [ ] User management interface implemented
- [ ] Role change functionality works
- [ ] System statistics displayed
- [ ] Admin navigation link added
- [ ] RLS policies allow admin access
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Admin page load time | < 2 seconds |
| Role change success rate | 100% |
| Unauthorized access blocked | 100% |

---

## 3. Database Requirements

**Uses existing tables:**
- **auth.users** - For user list (accessed via Supabase Admin API)
- **projects** - For admin view of all projects
- **tasks** - For admin view of all tasks

**Admin flag stored in `app_metadata`:**
- User's `app_metadata.is_admin` = true for admins
- RLS policies check: `(auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true`

**No additional tables needed.**

---

## 4. Backend/Service Layer

### Edge Functions for Admin Operations

**File**: `backend/supabase/functions/admin-get-users/index.ts`

**File**: `backend/supabase/functions/admin-update-role/index.ts`

### Service Module

**File**: `frontend/src/js/services/admin.js`

### Function Signatures

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Admin Panel | `frontend/public/admin.html` | Admin dashboard and user management |

### UI Layout Description

#### Admin Page (admin.html)

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Card | Statistics | `card`, `card-body` |
| Nav Tabs | Tab navigation | `nav`, `nav-tabs` |
| Table | User/Project/Task lists | `table`, `table-hover` |
| Badge | Role/Status/Priority | `badge`, `bg-primary/success` |
| Button | Actions | `btn`, `btn-sm`, `btn-warning` |
| Modal | Confirmation dialogs | `modal`, `modal-dialog` |

### JavaScript Interactions

#### Admin Page Script

---

## 6. Security Considerations

### Authorization Rules

- [ ] Admin page requires authentication
- [ ] Admin page checks user.role === 'admin'
- [ ] Non-admins redirected to dashboard
- [ ] RLS policies enforce admin-only data access
- [ ] Admin nav link hidden for regular users

### Role Management Security

- [ ] Only admins can change roles
- [ ] Prevent users from promoting themselves
- [ ] Require confirmation before role changes
- [ ] Log role changes (future enhancement)

---

## 7. Implementation Steps

- [ ] Outline database changes (tables, indexes, RLS)
- [ ] Define service layer functions and error handling
- [ ] Describe UI updates and required pages/components
- [ ] List integration touchpoints and config updates
- [ ] Note validation and edge cases to handle

---

## 9. Related Specs

### Dependencies (Must Complete First)

- [x] [04-authentication.md](./04-authentication.md) - Auth system with roles

### Depends On This (Blocked Until Complete)

- None (optional feature)

---

## Appendix

### Future Enhancements

- [ ] Add user deletion (with cascade)
- [ ] Add user account suspension
- [ ] Add activity logs/audit trail
- [ ] Add email notifications for role changes
- [ ] Add bulk user operations
- [ ] Add advanced system analytics
- [ ] Add user search and filtering
- [ ] Export user/project/task data to CSV
