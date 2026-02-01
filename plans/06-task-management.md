# Plan 06: Task Management

## Objective
Implement task CRUD, Kanban board, filtering, and real-time updates using Supabase Realtime.

## What's Needed

**Files:**
- `frontend/src/js/services/task-service.js` - Task CRUD operations
- `frontend/src/js/services/realtime-service.js` - Supabase Realtime subscriptions
- `frontend/src/js/pages/tasks.js` - Tasks page with Kanban board
- `frontend/public/tasks.html` - Complete UI
- `frontend/src/css/tasks.css` - Kanban board styles

**Functionality:**

**Task Service:**
- getTasks - List tasks with filters (project, status, assignee)
- getTask - Get single task
- createTask - Create new task (title, description, project, priority, due date, assignee)
- updateTask - Update task (including status changes)
- deleteTask - Delete task

**Realtime Service:**
- subscribeToTasks - Subscribe to task table changes
- Handle insert/update/delete events
- Update UI when other users make changes

**Tasks Page (Kanban Board):**
- 3 columns: To Do, In Progress, Done
- Drag-and-drop to change status (or click)
- Filters: project, status, assignee
- Create task modal/form
- Task detail modal (view/edit task, show attachments)
- Real-time updates across all users

**Real-time Updates:**
- Subscribe to tasks table on page load
- Listen for changes (insert, update, delete)
- Update UI when events received
- Unsubscribe on page unload

## Testing
- Can create tasks
- Tasks display in correct Kanban columns
- Can update task status (drag or click)
- Filters work correctly
- Real-time updates work (open two browsers, change in one, see in other)
- Multi-tenant isolation (can't see other company's tasks)
- Task detail modal shows all info

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 04 (Navigation & Routing)
- Plan 05 (Project Management)
