# Project Technical Summary

## Architecture
- **Frontend**: Multi-page vanilla JavaScript app (Vite + Bootstrap 5) with modular services and components.
- **Backend**: Express API server for auth, invites, companies, projects, tasks, and attachments.
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) for multi-tenant company isolation.
- **Auth**: Supabase Auth for user accounts and session management.
- **Real-time**: Supabase Realtime subscriptions for live updates across features.
- **Storage**: Supabase Storage for file attachments and uploads.
- **Code Structure**: Feature-based folder structure (`src/features/{feature}/pages`, `src/features/{feature}/components`, `src/shared/services`, `src/shared/components`).

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

**Core Tables:**

- **public.companies** (Multi-tenancy)
  - id (bigint, pk)
  - name, slug, domain
  - status (active, suspended, archived)
  - max_users, settings (jsonb)
  - created_at, updated_at

- **public.projects** (Project management)
  - id (bigint, pk)
  - name, description, icon, color, sort_order
  - space_id (spaces) - optional, groups projects into spaces
  - status (active, paused, archived)
  - start_year, end_year (2000-2100, for year filtering)
  - created_by (uuid, auth.users)
  - company_id (bigint, nullable - for personal user projects)
  - created_at, updated_at

- **public.spaces** (Project organization, Phase 1A)
  - id (bigint, pk)
  - name, icon, color, sort_order
  - created_by (uuid, auth.users)
  - company_id (bigint)
  - created_at, updated_at

- **public.tasks** (Task management)
  - id (bigint, pk)
  - title, description
  - status (custom per project, via status_definitions)
  - priority (low, medium, high, urgent)
  - start_date, due_date (with optional dependencies)
  - project_id (bigint)
  - assigned_to (uuid, auth.users, nullable)
  - created_by (uuid, auth.users)
  - company_id (bigint, nullable)
  - gantt_position (for custom ordering in Gantt view)
  - created_at, updated_at

- **public.status_definitions** (Custom statuses per project, Phase 1B)
  - id (bigint, pk)
  - project_id (bigint)
  - name, slug, color
  - sort_order, is_done, is_default
  - created_at, updated_at

- **public.checklists** (Subtasks & checklists, Phase 1C)
  - id (bigint, pk)
  - task_id (bigint)
  - title
  - created_by (uuid, auth.users)
  - created_at, updated_at

- **public.checklist_items**
  - id (bigint, pk)
  - checklist_id (bigint)
  - title
  - is_completed (boolean)
  - sort_order
  - created_at, updated_at

- **public.task_dependencies** (Gantt dependencies)
  - id (bigint, pk)
  - from_task_id (bigint)
  - to_task_id (bigint)
  - dependency_type (finish_to_start, finish_to_finish, start_to_start, start_to_finish)
  - created_at

- **public.comments** (Comments & mentions, Phase 2A)
  - id (bigint, pk)
  - task_id (bigint)
  - parent_comment_id (bigint, nullable - for threading)
  - author_id (uuid, auth.users)
  - content (text, may contain @mentions)
  - is_action_item (boolean)
  - action_assignee (uuid, auth.users, nullable)
  - action_resolved (boolean)
  - created_at, updated_at

- **public.mentions** (Mention tracking in comments)
  - id (bigint, pk)
  - comment_id (bigint)
  - mentioned_user_id (uuid, auth.users)
  - created_at

- **public.activity_log** (Activity tracking, Phase 2B)
  - id (bigint, pk)
  - entity_type (task, project, comment, attachment, time_entry)
  - entity_id (bigint)
  - action (created, updated, deleted, status_changed, assigned)
  - actor_id (uuid, auth.users)
  - changes (jsonb - field changes)
  - details (jsonb - context like project_name)
  - company_id (bigint)
  - created_at
  - Auto-generated via PostgreSQL triggers

- **public.notifications** (Notifications, Phase 2C)
  - id (bigint, pk)
  - user_id (uuid, auth.users)
  - type (mention, assignment, reply, status_change)
  - related_entity_type, related_entity_id (bigint)
  - is_read (boolean)
  - read_at (timestamp, nullable)
  - created_at
  - Auto-generated via triggers

- **public.user_status** (Team member status, Phase 2D)
  - user_id (uuid, pk, auth.users)
  - status (online, away, busy, offline)
  - status_message (nullable)
  - last_seen (timestamp)
  - updated_at

- **public.time_entries** (Time tracking, Phase 3A)
  - id (bigint, pk)
  - task_id (bigint)
  - user_id (uuid, auth.users)
  - start_time (timestamp)
  - end_time (timestamp, nullable - while timer running)
  - duration_seconds (integer, auto-calculated)
  - is_manual (boolean - true for manually entered)
  - description (nullable)
  - company_id (bigint)
  - created_at, updated_at

- **public.tags** (Tags/labels, Phase 3B)
  - id (bigint, pk)
  - name (unique per company)
  - color (hex color code)
  - created_by (uuid, auth.users)
  - company_id (bigint)
  - created_at, updated_at
  - Admin-only creation/editing

- **public.task_tags** (Task-tag junction)
  - id (bigint, pk)
  - task_id (bigint)
  - tag_id (bigint)
  - created_at

- **public.attachments** (File attachments)
  - id (bigint, pk)
  - task_id (bigint)
  - file_name, file_path (Supabase Storage path)
  - file_url (public URL)
  - file_size (bytes), mime_type
  - uploaded_by (uuid, auth.users)
  - created_at

- **public.invites** (Company invitations)
  - id (uuid, pk)
  - company_id (bigint)
  - email (unique per company)
  - token (unique)
  - role (user, admin)
  - invited_by (uuid, auth.users)
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

## Frontend Pages & Features

### 1. **Dashboard** (`dashboard.html`)
**Purpose**: User overview and activity tracking.

**Displayed Data:**
- **Dashboard Stats Cards**: Total projects, active tasks, completed (this week), overdue
- **My Tasks Widget**: Tasks assigned to current user with priority, project, due date, overdue indicator
- **Upcoming Deadlines Widget**: Tasks with upcoming due dates grouped by project
- **Project Progress Widget**: Progress bars with completion percentage and task counts
- **Recent Activity Feed**: Real-time activity log showing task/project/comment changes with timestamps

**Components Used:**
- Navbar (top navigation with notification bell)
- Sidebar (space/project navigation)
- Activity Feed component (lazy-loaded, real-time updates)

---

### 2. **Projects** (`projects.html`)
**Purpose**: Manage projects and organize work into spaces.

**Display Features:**
- **Project Cards**: Icon, name, color, status indicator, task count badge, year range (e.g., "📅 2024 - 2025")
- **Empty States**: For filters with no results
- **Responsive Grid Layout**: Adapts to screen size

**CRUD Operations (Admin Only):**
- **Create Project**: Modal form with name, description, icon, color, start year, end year
- **Edit Project**: Modify all fields except status when creating; archived status available when editing
- **Delete Project**: Single delete with confirmation or bulk delete via checkboxes
- **Bulk Operations**: Select multiple projects via checkboxes; bulk delete button

**Filters & Search:**
- **Status Filter**: Active, Paused, Archived dropdown
- **Year Filter**: Dynamically populated from project years in database
- **Search**: Real-time search across project names
- **Real-time Updates**: Live refresh when projects change

**Permission Model:**
- **Admin Users**: Full CRUD access
- **Regular Users**: View-only access
- **Personal Projects**: Creator (company_id IS NULL) always has full access

---

### 3. **Tasks** (`tasks.html`)
**Purpose**: Task management with multiple views and advanced filtering.

**Three View Modes:**

#### A. **Kanban Board View** (Default)
- **Dynamic Status Columns**: Per-project custom statuses (configurable in Admin Workflow Settings)
- **Task Cards**: Display title, priority icon, project name, task age (days), assigned user avatar, tag badges, due date
- **Drag & Drop**: Move cards between status columns; automatic status update and real-time sync
- **Visual Indicators**: Overdue dates highlighted, priority colors, tag colors

#### B. **List View**
- **Table Format**: Columns for Title, Project, Status, Priority, Due Date, Assignee
- **Row Click**: Opens task details modal
- **Sortable Headers**: Click to sort by column
- **Tag Display**: Inline tag badges

#### C. **Gantt Chart View** (Project timeline visualization)
- **Timeline Visualization**: Horizontal task bars with start/end dates
- **Dependencies**: Shown as connector lines between tasks; critical path highlighting
- **Gantt Controls**:
  - View mode selector (Day/Week/Month zoom)
  - Auto-schedule button (calculates dates based on dependencies)
  - Critical path toggle
  - Reorder tasks via drag (updates gantt_position)
- **Task Interaction**: Click task bar to open details; drag start/end to reschedule

**CRUD Operations:**

- **Create Task Modal**:
  - Title, description, project (required), priority, status, assigned user
  - Start date, due date (date pickers)
  - Optional dependencies on other tasks
  - Optional checklist creation

- **Edit Task Modal**:
  - All create fields plus:
  - Add/remove tags
  - Add/remove checklists
  - Upload/delete attachments
  - Create/delete task dependencies
  - Access Details, Comments, and Time Tracking tabs

- **View Task Modal**:
  - Full task details (read-only) with edit option
  - **Details Tab**: All task fields, attachments, dependencies
  - **Comments Tab**: Threaded comments with @mentions, action items, resolve/unresolve
  - **Time Tracking Tab**: Timer widget (start/stop), manual entries, total time per task
  - **Checklists Tab**: Subtask checklist with progress bar, add/remove items

- **Delete Task**: Confirmation modal before deletion

**Filters & Sorting:**
- **Project Filter**: Select project to view (shows only that project's tasks)
- **Status Filter**: Filter by task status (dynamic per project)
- **Priority Filter**: Low, Medium, High, Urgent
- **Tag Filter**: Filter by assigned tags
- **Assignee Filter**: Filter by team member
- **Search**: Full-text search on title and description
- **Client-side Filtering**: No reload, instant results

**Bulk Operations:**
- **Multi-Selection**: Checkbox on task cards (Kanban view)
- **Bulk Status Change**: Change status for multiple tasks at once
- **Bulk Delete**: Delete multiple tasks with confirmation
- **Bulk Tag Assignment**: Add/remove same tag for multiple tasks
- **Selection Counter**: Shows "X selected"

**Real-time Features:**
- Live updates when tasks change (Supabase Realtime subscriptions)
- Automatic status updates when dragging between columns
- Real-time comment/mention notifications

---

### 4. **Admin Panel** (`admin.html`)
**Purpose**: System administration and configuration (Admin or Sys Admin role required).

**Tabs:**

#### A. **System Admin Tab** (Sys Admin only)
- **Users Sub-Tab**:
  - View all users across all companies
  - Columns: Email, Name, Role, Company
  - Filter by company (dropdown with user counts)
  - Actions: Reset password (🔑 button), Delete user, Assign sys_admin role
  - Cannot delete self

- **Companies Sub-Tab**:
  - View all companies
  - Columns: Name, User Count, Project Count
  - Delete company (cascading delete)

#### B. **Team Members Tab** (Company Admin)
- **Team List Table**:
  - Columns: Email, Name, Role, Status (online/away/busy/offline), Last Seen
  - Actions: Edit, Reset Password, Promote to Admin, Delete

- **Add Team Member Modal**:
  - Email field, role selector (user/admin), send invite email

- **Edit Team Member Modal**:
  - Update name fields, change role, change status

#### C. **Workflow Settings Tab** (Company Admin)
- **Project Selection**: Dropdown to select which project's workflow to configure
- **Visual Status Editor**:
  - Drag-drop reordering of status columns
  - Add new status button (with name, color, mark-as-done flag)
  - Edit status (name, color, done flag)
  - Delete status
  - Set default status
  - Real-time preview

#### D. **Tags Tab** (Company Admin)
- **Tag Management**:
  - List all tags with color preview box, usage count
  - Create new tag (name, color picker)
  - Edit tag (name, color)
  - Delete tag
  - Usage count shows "X tasks using tag"

---

### 5. **Reports** (`reports.html`)
**Purpose**: Analytics and insights into task/team performance.

**Reports Generated:**

1. **Task Completion Metrics**
   - Total tasks in period, completed count, in-progress count
   - Completion rate with progress bar

2. **Status Distribution**
   - Table: Count and percentage per status
   - Visual progress bars, color-coded

3. **Priority Distribution**
   - Tasks by priority (low, medium, high, urgent)
   - Count and percentage per level

4. **Time Tracking Report**
   - Total hours tracked, hours per task, hours per team member
   - Table format with sorting

5. **Team Productivity**
   - Tasks completed per team member
   - Average completion time, time spent per person
   - Leaderboard-style display

6. **Overdue Tasks Report**
   - Tasks past due date
   - Grouped by duration (1-7 days, 1-4 weeks, 4+ weeks)
   - Table with sorting

**Filters:**
- **Project Filter**: Select specific project or all
- **User Filter**: Filter by team member
- **Date Range**: Custom date range selector
- **Date Presets**: Quick buttons (Last 7 Days, Last 30 Days, Last Quarter, Year-to-Date, Custom)

**Export Feature:**
- **CSV Export**: Download all report data as CSV file

---

### 6. **Landing Page** (`index.html`)
**Purpose**: Public landing page and sys_admin bootstrap.

**Features:**
- Marketing content and feature showcase
- One-time "Create First Admin" modal (appears if no admins exist)
- Bootstrap flow: Email → password → creates sys_admin user

---

### 7. **Authentication Pages**
- **signup.html**: Registration (standard + invite-based)
- **signin.html**: Login with email/password

---

## Shared Components

### **Navbar**
- App logo/name
- Navigation links to all pages
- Notification bell icon with unread count badge
- User menu (profile, logout)
- Real-time unread count updates

### **Sidebar**
- **Collapsible Spaces Hierarchy**: Click to expand/collapse spaces
- **Space Display**: Space name, icon, color, project count badge
- **Projects in Space**: Click space to load projects
- **Unassigned Projects**: Always-visible section for projects not in any space
- **Create Space Button**: Modal to create new space
- **Active Project Highlighting**: Current project is highlighted
- **Empty State**: Message when no spaces/projects exist

### **Notification Center** (Bell icon dropdown)
- **Lazy Loading**: Notifications load only when bell is clicked
- **Real-time Updates**: New notifications appear instantly
- **Notification List**: Shows type (mention, assignment, reply), related entity, timestamp
- **Unread Badge**: Red badge on bell icon shows unread count
- **Actions**: Mark as read, delete notification
- **Browser Notifications**: Optional desktop notifications for mentions/assignments
- **Quick Navigation**: Click notification to jump to related task

### **User Avatar Component**
- **Initials or Image**: User's initials or profile picture
- **Status Indicator**: Small circle (green=online, yellow=away, red=busy, gray=offline)
- **Tooltip**: Hover to see user info

---

## Service Layer (Data Operations)

### **Task Operations**
- `getTasks(filters)` - Get tasks with filters (project, status, priority, tag, assignee)
- `getTask(id)` - Get single task with all details
- `createTask(data)` - Create new task
- `updateTask(id, data)` - Update any task field
- `deleteTask(id)` - Delete task
- `getTaskDependencies(id)` - Get dependent tasks

### **Project Operations**
- `getProjects(filters)` - Get all projects (with optional task counts)
- `getProject(id)` - Get single project
- `createProject(data)` - Create new project
- `updateProject(id, data)` - Update project fields
- `deleteProject(id)` - Delete project and cascade delete tasks
- `canModifyProject(id)` - Check if user is admin for this project

### **Space Operations**
- `getSpaces()` - Get all spaces for company
- `getSpacesWithCounts()` - Include project counts
- `createSpace(data)` - Create new space
- `updateSpace(id, data)` - Update space
- `deleteSpace(id)` - Delete space (unassign projects)
- `getProjectsInSpace(spaceId)` - Get projects in space

### **Tag Operations**
- `getTags()` - Get all company tags
- `createTag(data)` - Create tag (admin only)
- `updateTag(id, data)` - Update tag (admin only)
- `deleteTag(id)` - Delete tag (admin only)
- `getTaskTags(taskId)` - Get tags on task
- `addTagToTask(taskId, tagId)` - Assign tag to task
- `removeTagFromTask(taskId, tagId)` - Remove tag from task

### **Checklist Operations**
- `getChecklists(taskId)` - Get all checklists on task
- `createChecklist(taskId, data)` - Create checklist
- `addChecklistItem(checklistId, data)` - Add item to checklist
- `updateChecklistItem(itemId, data)` - Mark item complete/incomplete
- `deleteChecklist(id)` - Delete entire checklist

### **Comment Operations**
- `getComments(taskId)` - Get all comments (threaded)
- `createComment(data)` - Create comment with @mentions
- `updateComment(id, data)` - Edit comment
- `deleteComment(id)` - Delete comment
- `resolveActionItem(commentId)` - Mark action item as resolved

### **Time Tracking Operations**
- `startTimer(taskId, description)` - Start a timer (prevents overlapping)
- `stopTimer(entryId)` - Stop timer and save duration
- `getActiveTimer()` - Get currently running timer (if any)
- `createManualEntry(taskId, startTime, endTime, description)` - Manually log time
- `getTimeEntries(taskId)` - Get all entries for task
- `getTotalTime(taskId)` - Get sum of all time on task
- `deleteTimeEntry(entryId)` - Remove time entry

### **Dashboard Operations**
- `getDashboardStats()` - Get overview stats
- `getMyTasks()` - Get tasks assigned to current user
- `getUpcomingDeadlines()` - Get tasks due soon
- `getProjectProgress()` - Get completion percentage per project

### **Reports Operations**
- `getTaskCompletionMetrics()` - Completion rate and counts
- `getStatusDistribution()` - Tasks by status
- `getPriorityDistribution()` - Tasks by priority
- `getTimeTrackingReport()` - Time summary
- `getTeamProductivity()` - Tasks per user metrics
- `getOverdueTasks()` - Overdue task grouping
- `exportToCSV()` - Export data to CSV file

### **Activity Operations**
- `getRecentActivity(options)` - Get activity log (paginated)
- `getTaskActivity(taskId)` - Get changes for specific task
- `getProjectActivity(projectId)` - Get changes for project
- Real-time subscription to activity changes

### **Notification Operations**
- `getNotifications(options)` - Get paginated notifications
- `getUnreadCount()` - Get count of unread notifications
- `markAsRead(id)` - Mark single notification read
- `deleteNotification(id)` - Delete notification
- Real-time subscription to new notifications

### **Status Operations**
- `getProjectStatuses(projectId)` - Get all custom statuses for project
- `createStatus(data)` - Create new status (admin only)
- `updateStatus(id, data)` - Update status (admin only)
- `deleteStatus(id)` - Delete status (admin only)
- `reorderStatuses(projectId, order)` - Drag-drop reordering

### **Team Operations**
- `getTeamMembers()` - Get all company users with status
- `getUserDetails(userId)` - Get user profile
- `updateStatus(status, message)` - Update user status (online/away/busy/offline)
- Real-time subscription to team status changes

### **Gantt Operations**
- `getGanttTasks(filters)` - Get tasks with dependencies for Gantt
- `getDependencies(taskId)` - Get dependent task relationships
- `createDependency(fromTaskId, toTaskId, type)` - Link tasks
- `removeDependency(fromTaskId, toTaskId)` - Unlink tasks
- `updateTaskDates(taskId, dates)` - Update start/end dates
- `getCriticalPath(projectId)` - Calculate critical path
- `autoScheduleTasks(projectId)` - Auto-schedule based on dependencies

### **Authentication & Authorization**
- `getCurrentUser()` - Get logged-in user
- `getUserCompanyId()` - Get user's company
- `isCompanyAdmin()` - Check if admin for company
- `isSystemAdmin()` - Check if system admin
- `logout()` - Sign out user

### **Real-time Subscriptions**
- `subscribeToProjects(callbacks)` - Listen to project changes
- `subscribeTotasks(filters, callbacks)` - Listen to task changes
- `subscribeToComments(taskId, callbacks)` - Listen to new comments
- `subscribeToActivityLog(callbacks)` - Listen to activity log
- `subscribeToNotifications(callbacks)` - Listen to new notifications
- `subscribeToTeamStatus(callbacks)` - Listen to user status changes

---

## RLS Policies & Security

All database tables use Row Level Security:
- **Company Isolation**: Users only see data for their company (via `company_id` column)
- **Personal Projects**: When `company_id IS NULL`, users can only see/modify projects they created
- **Helper Functions** (public schema):
  - `is_system_admin()` - Check if user has sys_admin role
  - `is_company_admin()` - Check if user has admin role in their company
  - `user_company_id()` - Get current user's company ID

- **3-Layer Enforcement**:
  - Database: RLS policies prevent unauthorized access
  - Backend: Express route guards check roles
  - Frontend: UI elements hidden based on role

---

## Summary

**Total Features Implemented:**
- 7 main pages (Dashboard, Projects, Tasks, Admin, Reports, Signup, Signin)
- 3 task views (Kanban, List, Gantt)
- 16+ database tables
- 20+ services for data operations
- 15+ reusable UI components
- Phase 1: Spaces, Custom Statuses, Checklists, Dashboard
- Phase 2: Comments, Activity Log, Notifications, Team Members
- Phase 3: Time Tracking, Tags, Reports & Analytics
- Multi-tenant company isolation via RLS
- 3 role types (sys_admin, admin, user) with granular permission controls
- Real-time updates across all features (Supabase Realtime)
- CSV export for reports
