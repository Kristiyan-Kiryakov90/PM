# 05 - Dashboard & Overview

> **Status**: 🟡 Pending
> **Phase**: Phase 2 - Project Management
> **Dependencies**: [04-authentication.md](./04-authentication.md)

---

## 1. Overview

### Feature Description
Create a user dashboard that displays an overview of projects, recent tasks, and user information. Serves as the main landing page after login.

### Goals
- Show user profile information
- Display project summary cards
- Show recent/upcoming tasks
- Provide quick navigation to projects and tasks
- Display statistics (total projects, tasks by status)

### User Value Proposition
Provides users with a at-a-glance view of their work and quick access to active projects and tasks.

### Prerequisites
- [x] [04-authentication.md](./04-authentication.md) - User must be authenticated to view dashboard

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** logged-in user
**I want to** see my projects and tasks overview
**So that** I can quickly understand my current workload

**As a** user
**I want to** navigate to projects or tasks pages
**So that** I can manage my work

### Acceptance Criteria

- [ ] Dashboard requires authentication (redirects if not logged in)
- [ ] Displays user's full name and email
- [ ] Shows total count of projects
- [ ] Shows count of tasks by status (todo, in progress, done)
- [ ] Lists user's projects with quick view cards
- [ ] Shows recent or upcoming tasks
- [ ] Navigation menu with links to all pages
- [ ] Logout button works correctly

### Definition of Done

- [ ] Dashboard page created and styled
- [ ] User data displayed correctly
- [ ] Project and task data loaded from Supabase
- [ ] Navigation works
- [ ] Logout functionality tested
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Page load time | < 2 seconds |
| Data refresh time | < 500ms |
| Navigation success | 100% |

---

## 3. Database Requirements

### Tables Used

- **users** - For user profile info
- **projects** - For project list and stats
- **tasks** - For task statistics and recent tasks

**No new tables needed** - Uses existing schema from [03-database-schema.md](./03-database-schema.md)

---

## 4. Backend/Service Layer

**No new service module needed** - Dashboard will query projects and tasks using services created in later specs. For now, can use direct Supabase client queries or create helper functions in dashboard.js.

### Dashboard Data Queries

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Dashboard | `frontend/public/dashboard.html` | Main user dashboard |

### UI Layout Description

#### Dashboard Page (dashboard.html)

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Navbar | Top navigation | `navbar`, `navbar-expand-lg`, `navbar-dark`, `bg-dark` |
| Dropdown | User menu | `dropdown`, `dropdown-menu` |
| Card | Statistics and projects | `card`, `shadow-sm` |
| Badge | Status and priority | `badge`, `bg-primary/success/warning` |
| Button | Actions | `btn`, `btn-primary`, `btn-outline-secondary` |
| List Group | Task list | `list-group`, `list-group-item` |
| Container | Layout | `container-fluid` |
| Row/Col | Grid layout | `row`, `col-md-6`, `col-lg-3` |

### JavaScript Interactions

#### Dashboard Load Event

---

## 6. Security Considerations

### Authentication Requirements

- [ ] Dashboard protected by `requireAuth()` guard
- [ ] All queries filtered by authenticated user ID
- [ ] RLS policies enforce data access control

### Authorization Rules

| Action | Role Required | Additional Checks |
|--------|---------------|-------------------|
| View dashboard | authenticated | User sees only their own data |
| View projects | authenticated | RLS filters to owned/assigned projects |
| View tasks | authenticated | RLS filters to assigned tasks |

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

- [x] [04-authentication.md](./04-authentication.md) - Need auth system and user session

### Depends On This (Blocked Until Complete)

- None - Dashboard is standalone (though it will be enhanced after projects/tasks are implemented)

### Related Features (Integration Points)

- [06-project-management.md](./06-project-management.md) - Dashboard links to projects page
- [07-task-management.md](./07-task-management.md) - Dashboard links to tasks page
- [10-admin-panel.md](./10-admin-panel.md) - Admin link in nav menu

### Documentation References

- [Project Summary](../ai-docs/project-summary.md) - Dashboard requirements
- [Coding Conventions](../ai-docs/coding-conventions.md) - Code style

---

## Appendix

### Useful Resources

- [Bootstrap Grid System](https://getbootstrap.com/docs/5.3/layout/grid/)
- [Bootstrap Cards](https://getbootstrap.com/docs/5.3/components/card/)
- [Bootstrap Navbar](https://getbootstrap.com/docs/5.3/components/navbar/)

### Notes & Considerations

- Dashboard can initially show placeholder data if no projects/tasks exist
- Statistics will be fully functional after projects and tasks features are implemented
- Dashboard queries should be optimized to avoid loading too much data

### Future Enhancements

- [ ] Add charts/graphs for task completion over time
- [ ] Add calendar view for upcoming tasks
- [ ] Add notifications for overdue tasks
- [ ] Add recent activity feed
- [ ] Add quick task creation widget
