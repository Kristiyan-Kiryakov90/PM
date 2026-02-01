# 07 - Task Management

> **Status**: 🟡 Pending
> **Phase**: Phase 3 - Task Management
> **Dependencies**: [06-project-management.md](./06-project-management.md)

---

## 1. Overview

### Feature Description
Task management system with role-based permissions and task history retention. All tasks and their statuses are visible to authenticated users. Normal users can create tasks and assign them to people, but only admins can assign tasks to projects. Deletions are soft deletes so completed-task history can be used for later statistics.

### Goals
- Create tasks service module
- Build tasks page with list/board view
- Implement task CRUD operations
- Add status management (todo, in_progress, done)
- Add priority levels (low, medium, high, urgent)
- Add due date tracking
- Filter tasks by status, priority, and project (project filtering is most relevant for admins)
- Enforce project assignment as an admin-only action

### User Value Proposition
Enables users to break down projects into manageable tasks with clear priorities, deadlines, and progress tracking.

### Prerequisites
- [x] [06-project-management.md](./06-project-management.md) - Tasks belong to projects

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** user
**I want to** create tasks and assign them to people
**So that** work can be tracked even before project assignment

**As a** user
**I want to** set task status, priority, and due dates
**So that** I can organize my work effectively

**As an** admin
**I want to** assign tasks to projects
**So that** tasks are properly categorized within the portfolio

**As a** user
**I want to** update task progress
**So that** I can track completion

**As a** user
**I want to** filter and search tasks
**So that** I can find specific tasks quickly

### Acceptance Criteria

- [ ] All authenticated users can view all tasks and their statuses
- [ ] Normal users can create tasks without assigning a project
- [ ] Normal users can assign tasks to people (assignees)
- [ ] Only admins can assign or change a task's project
- [ ] Tasks have title, description, status, priority, due date
- [ ] Users can update task details
- [ ] Users can change task status (todo → in_progress → done)
- [ ] Users can change task priority
- [ ] Tasks can be filtered by status and priority for all users
- [ ] Tasks can be filtered by project where project assignment exists
- [ ] Tasks display in list or kanban board view
- [ ] Normal users can delete tasks
- [ ] Task deletion is a soft delete that preserves task history for statistics
- [ ] Completed tasks are retained in history (via completion timestamps) even if deleted from the active UI
- [ ] Only authorized users can edit/delete tasks

### Definition of Done

- [ ] Tasks service module created
- [ ] Tasks page with role-aware CRUD rules
- [ ] All filtering works
- [ ] Status and priority management working
- [ ] Due dates functional
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Task creation success | > 98% |
| Page load time | < 2 seconds |
| Status update time | < 500ms |

---

## 3. Database Requirements

**tasks table** - Already created in [03-database-schema.md](./03-database-schema.md)

**No additional database changes needed.**

---

## 4. Backend/Service Layer

### Service Module

**File**: `frontend/src/js/services/tasks.js`

### Function Signatures

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Tasks | `frontend/public/tasks.html` | Task management page |

### UI Layout Description

#### Tasks Page (tasks.html)

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Modal | Create/Edit/Delete | `modal`, `modal-dialog` |
| List Group | Task list view | `list-group`, `list-group-item` |
| Card | Task cards (board view) | `card`, `card-body` |
| Badge | Status/Priority | `badge`, `bg-success/warning/danger` |
| Button | Actions | `btn`, `btn-primary`, `btn-sm` |
| Form | Input fields | `form-control`, `form-select` |
| Input Group | Date picker | `input-group` |

### Form Fields & Validation

#### Create/Edit Task Form

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| title | text | Yes | Min 3 chars, max 500 |
| description | textarea | No | Max 2000 chars |
| project_id | select | Admin only | Valid project UUID (admin only; optional otherwise) |
| status | select | Yes | todo/in_progress/done |
| priority | select | Yes | low/medium/high/urgent |
| due_date | date | No | Cannot be in the past |

**Validation Logic:**

---

## 6. Security Considerations

### Authorization Rules

| Action | Check | RLS Policy |
|--------|-------|------------|
| View tasks | User authenticated | RLS USING allows read |
| Create task (no project) | User authenticated | RLS WITH CHECK allows insert without project assignment |
| Assign/change project_id | User is admin | RLS WITH CHECK requires admin for project_id changes |
| Update non-project fields | User authenticated (or stricter per policy) | RLS USING allows updates except project_id unless admin |
| Delete task (soft delete) | User authenticated | RLS USING allows update of deleted_at rather than hard delete |

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

- [x] [06-project-management.md](./06-project-management.md) - Tasks need projects

### Depends On This (Blocked Until Complete)

- [08-task-assignment.md](./08-task-assignment.md) - Assignment uses task system
- [09-file-storage.md](./09-file-storage.md) - Attachments belong to tasks

### Related Features

- [05-dashboard.md](./05-dashboard.md) - Dashboard shows task stats

---

## Appendix

### Future Enhancements

- [ ] Add drag-and-drop for status changes
- [ ] Add task comments
- [ ] Add task dependencies
- [ ] Add recurring tasks
- [ ] Add task templates
