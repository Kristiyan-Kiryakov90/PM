# 08 - Task Assignment

> **Status**: 🟡 Pending
> **Phase**: Phase 3 - Task Management
> **Dependencies**: [07-task-management.md](./07-task-management.md)

---

## 1. Overview

### Feature Description
Enable task assignment to team members. Users can assign tasks to themselves or other users who have access to the project.

### Goals
- Add user selection dropdown to task forms
- Display assigned user on task cards
- Filter tasks by assignee
- Show unassigned tasks
- Update assignee from task list

### User Value Proposition
Enables collaboration by assigning specific tasks to team members, clarifying responsibility and workload.

### Prerequisites
- [x] [07-task-management.md](./07-task-management.md) - Task system exists

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** project owner
**I want to** assign tasks to team members
**So that** everyone knows their responsibilities

**As a** user
**I want to** see tasks assigned to me
**So that** I know what work I need to do

**As a** user
**I want to** filter tasks by assignee
**So that** I can see who is responsible for what

### Acceptance Criteria

- [ ] Task creation/edit forms include assignee selector
- [ ] Dropdown shows users who have access to the project
- [ ] Tasks can be unassigned (assignee = null)
- [ ] Assigned user displayed on task cards
- [ ] Filter tasks by assignee works
- [ ] "My Tasks" view shows user's assigned tasks
- [ ] Task assignment respects RLS policies

### Definition of Done

- [ ] Assignee field added to task forms
- [ ] User selector implemented
- [ ] Task display shows assignee
- [ ] Filter by assignee works
- [ ] "My Tasks" page/view created
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Assignment success rate | > 98% |
| User selector load time | < 500ms |

---

## 3. Database Requirements

**No changes needed** - assignee_id field already exists in tasks table from [03-database-schema.md](./03-database-schema.md)

---

## 4. Backend/Service Layer

### Service Module Functions (Add to tasks.js)

**File**: `frontend/src/js/services/tasks.js` (extend existing)

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Tasks | `frontend/public/tasks.html` | Modify existing tasks page |

### UI Layout Description (Modifications to tasks.html)

#### Updates to Task Forms

**Create/Edit Task Modal - Add Assignee Field:**

#### Updates to Task Display

**Task Card/List Item - Show Assignee:**

#### Add Assignee Filter

**Filter Bar - Add Assignee Filter:**

### JavaScript Interactions

#### Load Assignable Users

#### Handle Assignment Changes

#### Display Assignee Info

---

## 6. Security Considerations

### Authorization Rules

- [ ] Only project owners can assign tasks
- [ ] Only users with project access can be assigned
- [ ] Assignees can update task status but not reassign
- [ ] RLS policies enforce assignment constraints

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

- [x] [07-task-management.md](./07-task-management.md) - Tasks system needed

### Depends On This (Blocked Until Complete)

- None (optional feature)

### Related Features

- [05-dashboard.md](./05-dashboard.md) - Dashboard can show "My Tasks"
- [10-admin-panel.md](./10-admin-panel.md) - Admin can see all assignments

---

## Appendix

### Future Enhancements

- [ ] Add notifications when task is assigned
- [ ] Add email notifications for assignments
- [ ] Add bulk assignment
- [ ] Add team/group assignments
- [ ] Add assignment history tracking
