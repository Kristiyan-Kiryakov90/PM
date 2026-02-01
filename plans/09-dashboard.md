# Plan 09: Dashboard

## Objective
Create user dashboard with stats, recent activity, and quick actions.

## What's Needed

**Files:**
- `frontend/src/js/pages/dashboard.js` - Dashboard logic
- `frontend/public/dashboard.html` - Complete UI
- `frontend/src/css/dashboard.css` - Dashboard-specific styles

**Functionality:**

**Dashboard Stats:**
- My Tasks count (assigned to current user)
- Projects count (in company)
- Overdue tasks count
- Tasks by status breakdown

**Recent Activity:**
- 5 most recent tasks (assigned to user or created by user)
- Show title, project, status, due date
- Click to view task detail

**Quick Actions:**
- "New Project" button → projects page
- "New Task" button → tasks page with create modal
- Recent projects list (clickable)

**Data Loading:**
- Fetch data in parallel (Promise.all)
- Show loading states while fetching
- Handle errors gracefully

## Testing
- Dashboard displays correct stats
- Stats update after creating/deleting projects/tasks
- Recent tasks show correctly
- Quick action buttons work
- Loading states display
- Multi-tenant isolation (stats only from own company)
- Redirects to signin if not authenticated

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 04 (Navigation & Routing)
- Plan 05 (Project Management)
- Plan 06 (Task Management)
