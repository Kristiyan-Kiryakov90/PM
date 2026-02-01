# 06 - Project Management

> **Status**: 🟡 Pending
> **Phase**: Phase 2 - Project Management
> **Dependencies**: [04-authentication.md](./04-authentication.md), [05-dashboard.md](./05-dashboard.md)

---

## 1. Overview

### Feature Description
Project management system with role-based permissions. Admins can create, view, edit, and delete projects. Normal users can view projects and their statuses only.

### Goals
- Create projects service module with admin-only write operations
- Build projects page with list/grid view
- Implement create project modal/form (admin only)
- Implement edit project functionality (admin only)
- Implement delete project with confirmation (admin only)
- Add project status management (active, completed, archived)
- Add project filtering and search
- Ensure normal users see a read-only view

### User Value Proposition
Enables users to organize their work into distinct projects, making it easier to manage multiple initiatives simultaneously.

### Prerequisites
- [x] [04-authentication.md](./04-authentication.md) - User authentication required
- [x] [05-dashboard.md](./05-dashboard.md) - Navigation structure exists

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As an** admin
**I want to** create new projects
**So that** the organization can structure work consistently

**As a** user
**I want to** view projects and their statuses
**So that** I can understand what work exists and its current state

**As an** admin
**I want to** edit project details
**So that** project definitions remain accurate

**As an** admin
**I want to** archive or delete projects
**So that** the project catalog stays clean and intentional

**As a** user
**I want to** see project status (active, completed, archived)
**So that** I can focus on current work

### Acceptance Criteria

- [ ] Admins can create projects with name and description
- [ ] Projects list shows all projects relevant to the user role
- [ ] Each project displays name, description, status, and creation date
- [ ] Admins can edit project details
- [ ] Admins can change project status
- [ ] Admins can delete projects (with confirmation)
- [ ] Deleted projects remove all associated tasks
- [ ] Projects can be filtered by status
- [ ] Search functionality filters projects by name
- [ ] Normal users cannot see create/edit/delete controls
- [ ] Only admins can create/update/delete projects (enforced by RLS and UI guards)

### Definition of Done

- [ ] Projects service module created
- [ ] Projects page created with admin CRUD and user read-only view
- [ ] All user flows tested
- [ ] RLS policies enforced
- [ ] Error handling works
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Project creation success rate | > 98% |
| Page load time | < 2 seconds |
| Search response time | < 300ms |

---

## 3. Database Requirements

### Tables Used

**projects table** - Already created in [03-database-schema.md](./03-database-schema.md)

**RLS policies must reflect admin-only CRUD:**
- All authenticated users can view projects (at minimum name + status)
- Only admins can insert projects
- Only admins can update projects
- Only admins can delete projects

**Note:** This spec updates the previously stated owner-based CRUD model.

---

## 4. Backend/Service Layer

### Service Module

**File**: `frontend/src/js/services/projects.js`

### Function Signatures

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Projects | `frontend/public/projects.html` | List and manage projects |

### UI Layout Description

#### Projects Page (projects.html)

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Modal | Create/Edit/Delete dialogs | `modal`, `modal-dialog`, `modal-content` |
| Card | Project display | `card`, `card-body`, `shadow-sm` |
| Badge | Status indicators | `badge`, `bg-success/primary/secondary` |
| Button | Actions | `btn`, `btn-primary`, `btn-danger`, `btn-outline-secondary` |
| Form | Input fields | `form-control`, `form-label`, `form-select` |
| Input Group | Search bar | `input-group` |
| Grid | Layout | `row`, `col-md-4` |

### Form Fields & Validation

#### Create/Edit Project Form

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| name | text | Yes | Min 3 characters, max 255 |
| description | textarea | No | Max 1000 characters |
| status | select | Yes | Must be: active, completed, archived |

**Validation Logic:**

### JavaScript Interactions

#### Projects Page Event Handlers

---

## 6. Security Considerations

### Authorization Rules

| Action | Check | RLS Policy |
|--------|-------|------------|
| Create project | User is admin | RLS WITH CHECK on admin flag |
| View projects | User authenticated | RLS USING allows read |
| Update project | User is admin | RLS USING + WITH CHECK on admin flag |
| Delete project | User is admin | RLS USING on admin flag |

### Input Validation

- [ ] Validate project name length (3-255 chars)
- [ ] Sanitize description input
- [ ] Validate status enum values
- [ ] Prevent XSS in project name/description display

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

- [x] [04-authentication.md](./04-authentication.md) - Auth required
- [x] [05-dashboard.md](./05-dashboard.md) - Navigation structure

### Depends On This (Blocked Until Complete)

- [07-task-management.md](./07-task-management.md) - Tasks belong to projects

### Related Features (Integration Points)

- [05-dashboard.md](./05-dashboard.md) - Dashboard shows project stats
- [07-task-management.md](./07-task-management.md) - Tasks page filters by project

---

## Appendix

### Future Enhancements

- [ ] Add project templates
- [ ] Add project sharing/collaboration
- [ ] Add project tags/categories
- [ ] Add project archive/restore
- [ ] Add bulk operations
