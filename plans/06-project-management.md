# Plan 06: Comprehensive Project Management — ClickUp-Inspired Feature Roadmap

## Objective
Transform TaskFlow from a basic CRUD project/task manager into a full-featured, modern project management platform comparable to ClickUp. This plan covers all functionalities: hierarchy, views, collaboration, automation, reporting, documents, and polish.

## Current State
- **5 DB tables:** companies, projects, tasks, attachments, profiles (+ invites)
- **9 HTML pages:** landing, signup, signin, dashboard, projects, tasks, admin, profile, diagnostic
- **Working features:** Project CRUD (card grid, status filter, bulk delete), Task Kanban (3 columns, CRUD, priority, due dates, attachments, real-time), Auth (3 roles), Multi-tenancy (RLS)
- **Placeholders:** Dashboard (shows zeros), Admin panel (empty tabs)
- **Tech:** Vanilla JS + Vite + Bootstrap 5 + Supabase (Postgres + Auth + Storage + Realtime)

### Existing Database (IMPORTANT — match these conventions)
**ID convention:** All existing tables use `bigint GENERATED ALWAYS AS IDENTITY` for PKs, NOT uuid. New tables MUST follow the same pattern.
**FK types:** `company_id`, `project_id`, `task_id` are `bigint`. User references (`created_by`, `assigned_to`, `user_id`) are `uuid` (FK to `auth.users.id`).
**Existing tables:**
| Table | PK Type | Key Columns |
|-------|---------|------------|
| companies | bigint | name, status, settings(jsonb) |
| projects | bigint | company_id(bigint, nullable), name, description, status, created_by(uuid) |
| tasks | bigint | company_id(bigint, nullable), project_id(bigint), title, description, status, priority, assigned_to(uuid), created_by(uuid), due_date, completed_at |
| attachments | bigint | company_id(bigint, nullable), task_id(bigint), file_name, file_path, file_size, mime_type, uploaded_by(uuid) |
| profiles | uuid | company_id(bigint, nullable), role |
**Storage:** `task-attachments` bucket already exists with 4 RLS policies (INSERT/SELECT/DELETE/UPDATE for authenticated).
**Helper functions (reuse):** `auth.user_company_id()`, `auth.is_system_admin()`, `auth.is_company_admin()` — all in `auth` schema.
**Existing functions (reuse):** `public.list_company_users()`, `public.check_sys_admin_exists()`, `public.handle_new_user_profile()` trigger.
**Constraints on tasks.status:** `CHECK (status IN ('todo','in_progress','review','done'))` — must be dropped for Phase 1B.

---

## PHASE 1: Foundation Upgrades

### 1A. Organizational Hierarchy — Spaces

ClickUp uses Spaces > Folders > Lists > Tasks. We implement: **Spaces** (top-level containers) → **Projects** (existing, act as Lists) → **Tasks**.

**Database:**
```sql
CREATE TABLE spaces (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (trim(name) <> ''),
    description text,
    color text DEFAULT '#3b82f6',
    icon text DEFAULT 'folder',
    sort_order integer DEFAULT 0,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ADD COLUMN space_id bigint REFERENCES spaces(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN color text DEFAULT '#3b82f6';
ALTER TABLE projects ADD COLUMN icon text DEFAULT 'list';
ALTER TABLE projects ADD COLUMN sort_order integer DEFAULT 0;
```

**Files:**
- `backend/database/migrations/20260209_001_create_spaces.sql`
- `frontend/src/js/services/space-service.js` — CRUD
- `frontend/src/js/components/sidebar.js` — collapsible sidebar with Space → Project tree
- `frontend/src/css/sidebar.css`
- Modified: `frontend/src/js/pages/projects.js` — group by space
- Modified: `frontend/public/projects.html` — sidebar layout

**UI:** Left sidebar (280px, collapsible to 60px icon-only). Tree: each Space expandable with its Projects as children. "+" buttons to create projects within spaces. Drag to reorder. Color dots and icons per space.

---

### 1B. Custom Statuses per Project

Replace hardcoded statuses with configurable ones per project.

**Database:**
```sql
CREATE TABLE status_definitions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (trim(name) <> ''),
    slug text NOT NULL,
    color text DEFAULT '#6b7280',
    sort_order integer DEFAULT 0,
    is_done boolean DEFAULT false,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE (project_id, slug)
);

-- Remove CHECK constraint from tasks.status
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
```

When a project is created, seed it with defaults: To Do, In Progress, Review, Done. Kanban columns generated dynamically from `status_definitions`.

**Files:**
- `backend/database/migrations/20260209_002_create_status_definitions.sql`
- `frontend/src/js/services/status-service.js`
- Modified: `frontend/src/js/pages/tasks.js` — dynamic Kanban columns
- Modified: `frontend/src/js/pages/projects.js` — project settings modal with "Statuses" tab

**UI:** Project settings → "Statuses" tab: add/remove/reorder/recolor statuses with drag handles. Done-type statuses grouped at board right end.

---

### 1C. Subtasks and Checklists

**Database:**
```sql
ALTER TABLE tasks ADD COLUMN parent_task_id bigint REFERENCES tasks(id) ON DELETE CASCADE;

CREATE TABLE checklists (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (trim(title) <> ''),
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE checklist_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_id bigint NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (trim(content) <> ''),
    is_completed boolean DEFAULT false,
    completed_at timestamptz,
    completed_by uuid,
    sort_order integer DEFAULT 0,
    assigned_to uuid,
    due_date timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**Files:**
- `backend/database/migrations/20260209_003_add_subtasks_checklists.sql`
- `frontend/src/js/services/checklist-service.js`
- Modified: `frontend/src/js/services/task-service.js` — `getSubtasks(taskId)`, `parent_task_id` support
- Modified: `frontend/src/js/pages/tasks.js` — subtask indicator on cards, nested subtasks and checklists in detail modal

**UI:** Task cards show "2/5 subtasks" progress indicator. Task detail modal: "Subtasks" section with inline creation. "Checklist" section with toggleable items, progress bar, optional assignee/due date per item.

---

### 1D. Dashboard with Real Data

Replace placeholder dashboard with actual stats and activity.

**Files:**
- `frontend/src/js/services/dashboard-service.js` — `getDashboardStats()`, `getMyTasks()`, `getUpcomingDeadlines()`, `getProjectProgress()`
- Modified: `frontend/src/js/pages/dashboard.js`
- Modified: `frontend/public/dashboard.html`
- Modified: `frontend/src/css/dashboard.css`

**Widgets:**
1. **Stat Cards Row:** Total Projects, Active Tasks, Completed This Week, Overdue Tasks
2. **My Tasks:** tasks assigned to current user, grouped by status
3. **Recent Activity:** latest actions from activity_log (Phase 2B)
4. **Project Progress:** horizontal bar charts showing completion % per project
5. **Upcoming Deadlines:** tasks due within 7 days, sorted by date

---

### 1E. Sidebar + Topbar Navigation

Replace top-only navbar with sidebar + slim topbar layout for all protected pages.

**Files:**
- `frontend/src/js/components/sidebar.js` — left sidebar
- `frontend/src/js/components/topbar.js` — slim topbar with search, notifications, user menu
- `frontend/src/css/sidebar.css`, `frontend/src/css/topbar.css`, `frontend/src/css/layout.css`
- Deprecated: `frontend/src/js/components/navbar.js`
- Modified: All 6 protected HTML pages — new layout structure

**UI:** Sidebar (280px, collapsible): Spaces/Projects tree, Favorites, Quick links (Dashboard, My Tasks). Topbar: logo, global search, notification bell, user avatar dropdown. Mobile: sidebar becomes slide-out drawer.

---

## PHASE 2: Collaboration & Activity

### 2A. Comments and Mentions

**Database:**
```sql
CREATE TABLE comments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    parent_comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,
    author_id uuid NOT NULL,
    content text NOT NULL CHECK (trim(content) <> ''),
    is_action_item boolean DEFAULT false,
    action_assignee uuid,
    action_resolved boolean DEFAULT false,
    action_resolved_at timestamptz,
    edited_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE mentions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comment_id bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**Files:**
- `backend/database/migrations/20260210_001_create_comments_mentions.sql`
- `frontend/src/js/services/comment-service.js`
- `frontend/src/js/components/comment-thread.js` — reusable threaded comment list
- `frontend/src/js/components/mention-input.js` — @mention autocomplete input
- `frontend/src/css/comments.css`
- Modified: `frontend/src/js/pages/tasks.js` — "Comments" tab in task detail modal

**UI:** Task detail modal → "Comments" tab. Input with @mention (autocomplete company users). Threaded replies indented. Action items with checkbox. Real-time via Supabase subscription.

---

### 2B. Activity Log

**Database:**
```sql
CREATE TABLE activity_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL,
    entity_type text NOT NULL,  -- 'task', 'project', 'comment', 'attachment'
    entity_id bigint NOT NULL,
    action text NOT NULL,        -- 'created', 'updated', 'deleted', 'status_changed', 'assigned', 'commented'
    details jsonb DEFAULT '{}',  -- { field: 'status', old: 'todo', new: 'done' }
    created_at timestamptz DEFAULT now()
);
```

Activity entries created via PostgreSQL triggers on tasks, projects, and comments tables.

**Files:**
- `backend/database/migrations/20260210_002_create_activity_log.sql`
- `frontend/src/js/services/activity-service.js`
- `frontend/src/js/components/activity-feed.js` — reusable feed component
- `frontend/src/css/activity.css`
- Modified: `frontend/src/js/pages/dashboard.js` — "Recent Activity" widget

---

### 2C. Notifications System

**Database:**
```sql
CREATE TABLE notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    type text NOT NULL,  -- 'mention', 'assignment', 'due_soon', 'comment', 'status_change'
    title text NOT NULL,
    message text,
    entity_type text,
    entity_id bigint,
    is_read boolean DEFAULT false,
    read_at timestamptz,
    created_at timestamptz DEFAULT now()
);
```

**Files:**
- `backend/database/migrations/20260210_003_create_notifications.sql`
- `frontend/src/js/services/notification-service.js`
- `frontend/src/js/components/notification-dropdown.js` — bell icon with dropdown
- `frontend/src/css/notifications.css`
- Modified: `frontend/src/js/components/topbar.js` — integrate bell
- Modified: `frontend/src/js/services/realtime-service.js` — subscribe to notifications

**UI:** Bell icon in topbar with unread count badge. Dropdown: latest 20 notifications grouped by today/earlier. Click navigates to entity. "Mark all as read" button.

---

### 2D. Team Members & User Components

**Files:**
- Modified: `frontend/src/js/services/task-service.js` — functional `getCompanyUsers()` using existing `public.list_company_users()` RPC
- `frontend/src/js/components/user-avatar.js` — reusable avatar with initials/color
- `frontend/src/js/components/user-picker.js` — dropdown for user selection (assignee, mentions)
- `frontend/src/css/avatars.css`
- Modified: `frontend/src/js/pages/admin.js` — functional team members list with roles

---

## PHASE 3: Multiple Views

### 3A. View Switcher Infrastructure

**Database:**
```sql
CREATE TABLE saved_views (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
    created_by uuid NOT NULL,
    name text NOT NULL,
    view_type text NOT NULL CHECK (view_type IN ('board','list','table','calendar','gantt','timeline','activity')),
    config jsonb DEFAULT '{}',
    is_default boolean DEFAULT false,
    is_shared boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Files:**
- `backend/database/migrations/20260211_001_create_saved_views.sql`
- `frontend/src/js/services/view-service.js`
- `frontend/src/js/components/view-switcher.js` — horizontal tab bar
- `frontend/src/js/utils/view-renderer.js` — factory that instantiates correct view
- `frontend/src/css/view-switcher.css`

**UI:** Tab bar below filters: Board | List | Table | Calendar | Gantt. "+" to save current config. Saved views as additional tabs.

---

### 3B. List View

Traditional flat task list with sorting, filtering, grouping.

**Files:** `frontend/src/js/views/list-view.js`, `frontend/src/css/list-view.css`

**UI:** Each row: checkbox, priority dot, task title, status badge, assignee avatar, due date, project. Group by: Status/Priority/Assignee/Project/Due Date (collapsible). Sort by column header click. Inline status and priority dropdowns. Bulk select checkboxes. Pagination (50/page).

---

### 3C. Table View (Spreadsheet)

**Files:** `frontend/src/js/views/table-view.js`, `frontend/src/css/table-view.css`

**UI:** Full-width grid. Columns: Title, Status, Priority, Assignee, Due Date, Project, Created (configurable). Click-to-sort headers, drag-to-reorder, resize handles. Inline cell editing (text, dropdowns, date pickers). Fixed left column with horizontal scroll. Column visibility toggle.

**Implementation:** Lightweight virtual-scroll table using CSS Grid, no library.

---

### 3D. Calendar View

**Files:** `frontend/src/js/views/calendar-view.js`, `frontend/src/css/calendar-view.css`

**Database:** `ALTER TABLE tasks ADD COLUMN start_date timestamptz;`

**UI:** Monthly 7x6 grid. Tasks as colored bars on due date (or spanning start→due). Color by priority or status. Prev/next month navigation, today button. Click day → popover with tasks + "New Task". Click task → detail modal. Drag task to reschedule.

---

### 3E. Gantt Chart View

**Database:**
```sql
CREATE TABLE task_dependencies (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type text DEFAULT 'finish_to_start',
    created_at timestamptz DEFAULT now(),
    CHECK (task_id <> depends_on_task_id),
    UNIQUE (task_id, depends_on_task_id)
);
```

**Files:** `frontend/src/js/views/gantt-view.js`, `frontend/src/css/gantt-view.css`

**UI:** Left panel: task list (name, assignee). Right panel: SVG horizontal timeline. Tasks as bars spanning start_date→due_date. Dependency arrows (SVG bezier curves). Drag edges to resize, drag bar to move. Today line (red dashed). Zoom: Day | Week | Month | Quarter. Color by assignee/priority/status. Critical path highlighting.

**Implementation:** Pure SVG + vanilla JS, no charting library.

---

## PHASE 4: Advanced Task Features

### 4A. Custom Fields

**Database:**
```sql
CREATE TABLE custom_field_definitions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    field_type text NOT NULL CHECK (field_type IN ('text','number','dropdown','date','checkbox','url','email','phone','rating','progress','currency','label','multi_select')),
    config jsonb DEFAULT '{}',
    is_required boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE custom_field_values (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    field_id bigint NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    value_text text,
    value_number numeric,
    value_date timestamptz,
    value_boolean boolean,
    value_json jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (field_id, task_id)
);
```

**Files:**
- `frontend/src/js/services/custom-field-service.js`
- `frontend/src/js/components/custom-field-renderer.js` — view mode by type
- `frontend/src/js/components/custom-field-editor.js` — edit mode by type
- Modified: `frontend/src/js/pages/projects.js` — project settings "Custom Fields" tab
- Modified: task detail modal — custom fields section

---

### 4B. Tags and Labels

**Database:**
```sql
CREATE TABLE tags (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (trim(name) <> ''),
    color text DEFAULT '#6b7280',
    created_at timestamptz DEFAULT now(),
    UNIQUE (company_id, name)
);

CREATE TABLE task_tags (
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);
```

**Files:**
- `frontend/src/js/services/tag-service.js`
- `frontend/src/js/components/tag-picker.js` — multi-select with color pills
- `frontend/src/css/tags.css`
- Modified: task cards, list view, table view — show tag pills

---

### 4C. Task Types and Templates

**Database:**
```sql
CREATE TABLE task_types (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (trim(name) <> ''),
    icon text DEFAULT 'task',
    color text DEFAULT '#3b82f6',
    default_fields jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE task_templates (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (trim(name) <> ''),
    description text,
    task_type_id bigint REFERENCES task_types(id) ON DELETE SET NULL,
    template_data jsonb NOT NULL,
    created_by uuid NOT NULL,
    is_shared boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN task_type_id bigint REFERENCES task_types(id) ON DELETE SET NULL;
```

**Files:**
- `frontend/src/js/services/template-service.js`
- `frontend/src/js/components/template-picker.js` — modal for template selection
- Modified: task creation flow — "Create from template" option

---

### 4D. Multiple Assignees and Task Relationships

**Database:**
```sql
CREATE TABLE task_assignees (
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role text DEFAULT 'assignee',  -- 'assignee', 'reviewer', 'watcher'
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid NOT NULL,
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE task_relationships (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    related_task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relationship_type text NOT NULL,  -- 'related', 'duplicate', 'blocks', 'blocked_by'
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    CHECK (task_id <> related_task_id),
    UNIQUE (task_id, related_task_id, relationship_type)
);
```

Existing `tasks.assigned_to` kept as primary assignee for backward compatibility.

---

### 4E. Recurring Tasks

**Database:**
```sql
ALTER TABLE tasks ADD COLUMN recurrence_rule jsonb;
ALTER TABLE tasks ADD COLUMN recurrence_parent_id bigint REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN is_recurring boolean DEFAULT false;
```

`recurrence_rule` format: `{ frequency: 'daily'|'weekly'|'monthly'|'yearly', interval: 1, days_of_week: [1,3,5], end_date: null }`. When a recurring task is marked "done", a trigger/Edge Function creates the next occurrence.

---

### 4F. Time Tracking

**Database:**
```sql
CREATE TABLE time_entries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    started_at timestamptz NOT NULL,
    ended_at timestamptz,
    duration_seconds integer,
    description text,
    is_billable boolean DEFAULT false,
    is_running boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN time_estimate_seconds integer;
```

**Files:**
- `frontend/src/js/services/time-service.js` — start/stop, manual entry, reports
- `frontend/src/js/components/timer-widget.js` — floating timer in topbar
- `frontend/src/css/timer.css`
- Modified: task detail modal — time tracking section with start/stop, logged entries, estimated vs actual bar

---

## PHASE 5: Reporting & Dashboards

### 5A. Customizable Dashboard Widgets

**Database:**
```sql
CREATE TABLE dashboard_layouts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    name text DEFAULT 'My Dashboard',
    layout jsonb NOT NULL,  -- [{ widget_type, x, y, w, h, config }]
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Widget Types:** stat-card, bar-chart, line-chart, pie-chart, task-list, activity-feed, time-report, progress-bars, calendar-mini, workload-bars

**Files:**
- `frontend/src/js/components/widgets/` — one file per widget type
- `frontend/src/js/components/dashboard-grid.js` — drag-to-arrange layout
- `frontend/src/js/utils/chart-helpers.js` — SVG-based charts (bar, line, pie, progress)
- `frontend/src/css/widgets.css`, `frontend/src/css/charts.css`

---

### 5B. Goals and Milestones

**Database:**
```sql
CREATE TABLE goals (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    target_type text NOT NULL,  -- 'number', 'percentage', 'boolean', 'task_completion'
    target_value numeric,
    current_value numeric DEFAULT 0,
    unit text,
    due_date timestamptz,
    status text DEFAULT 'on_track',
    owner_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE goal_targets (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id bigint NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id bigint NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

Milestones: use task_types (Phase 4C) to mark tasks as milestones — appear as diamonds on Gantt.

**Files:**
- `frontend/src/js/services/goal-service.js`
- `frontend/public/goals.html`
- `frontend/src/js/pages/goals.js`

---

### 5C. Workload View

**Files:** `frontend/src/js/views/workload-view.js`, `frontend/src/css/workload.css`, `frontend/public/workload.html`

**UI:** Left column: team member rows (avatar, name). Right: horizontal bars per person per day/week showing task count. Capacity line (configurable). Color: green (under), yellow (at), red (over capacity). Click bar → see tasks. Date range selector.

---

## PHASE 6: Search, Automation & Power Features

### 6A. Command Palette and Global Search

**Database:**
```sql
ALTER TABLE tasks ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX tasks_search_idx ON tasks USING gin(search_vector);

ALTER TABLE projects ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX projects_search_idx ON projects USING gin(search_vector);
```

**Files:** `frontend/src/js/components/command-palette.js`, `frontend/src/css/command-palette.css`

**UI:** `Ctrl+K` / `Cmd+K` triggers modal overlay. Search input at top. Sections: Recent, Tasks, Projects, Spaces, Commands. Fuzzy client-side search + server-side full-text via tsvector. Arrow keys navigate, Enter selects, Escape closes.

---

### 6B. Keyboard Shortcuts

**Files:** `frontend/src/js/utils/hotkeys.js`, `frontend/src/js/components/hotkey-help.js`

| Key | Action |
|-----|--------|
| `Ctrl+K` | Command palette |
| `N` | New task |
| `P` | New project |
| `B/L/T` | Board/List/Table view |
| `/` | Focus search |
| `?` | Show shortcuts |
| `Esc` | Close modal |
| `1-4` | Set priority |
| `J/K` | Navigate up/down |

---

### 6C. Advanced Filtering and Saved Filters

**Database:**
```sql
CREATE TABLE saved_filters (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    name text NOT NULL,
    filters jsonb NOT NULL,  -- { conditions: [{field, operator, value}], logic: 'AND'|'OR' }
    is_shared boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
```

**Files:**
- `frontend/src/js/components/filter-builder.js` — visual filter builder
- `frontend/src/js/services/filter-service.js`
- `frontend/src/css/filter-builder.css`

**UI:** Filter bar with active pills. "+" to add conditions. Each: Field | Operator | Value. Operators: is, is not, contains, empty, before/after, greater/less. AND/OR logic. Save as named preset.

---

### 6D. Automation Engine

**Database:**
```sql
CREATE TABLE automations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    trigger_type text NOT NULL,     -- 'status_change', 'assignment', 'due_date', 'creation', 'field_change'
    trigger_config jsonb NOT NULL,
    conditions jsonb DEFAULT '[]',
    actions jsonb NOT NULL,         -- [{ type: 'assign'|'set_status'|'add_tag'|'set_priority'|'move_to_project'|'create_subtask'|'send_notification'|'add_comment', value }]
    run_count integer DEFAULT 0,
    last_run_at timestamptz,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE automation_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    automation_id bigint NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    trigger_entity_type text NOT NULL,
    trigger_entity_id bigint NOT NULL,
    actions_executed jsonb NOT NULL,
    success boolean DEFAULT true,
    error_message text,
    executed_at timestamptz DEFAULT now()
);
```

**Implementation:** PostgreSQL triggers on tasks table evaluate matching automations. Complex actions via Supabase Edge Functions.

**Files:**
- `frontend/src/js/services/automation-service.js`
- `frontend/src/js/pages/automations.js`
- `frontend/public/automations.html`
- `frontend/src/css/automations.css`

**UI:** Builder: "When [trigger] and [conditions], then [actions]". Each section as dropdown/form. List with active/inactive toggle. Execution log.

---

## PHASE 7: Documents, Forms & Integrations

### 7A. Documents / Wiki

**Database:**
```sql
CREATE TABLE documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    parent_document_id bigint REFERENCES documents(id) ON DELETE CASCADE,
    project_id bigint REFERENCES projects(id) ON DELETE SET NULL,
    title text NOT NULL CHECK (trim(title) <> ''),
    content jsonb NOT NULL DEFAULT '{}',
    content_text text,
    created_by uuid NOT NULL,
    last_edited_by uuid,
    is_template boolean DEFAULT false,
    is_published boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Files:**
- `frontend/src/js/services/document-service.js`
- `frontend/src/js/pages/docs.js`
- `frontend/public/docs.html`
- `frontend/src/css/docs.css`
- `frontend/src/js/components/rich-text-editor.js` — lightweight editor (Quill.js or custom contenteditable)

**UI:** Sidebar document tree (nested pages). Full-width editor. Toolbar: headings, bold, italic, lists, code, links, images, task toggles. Document hub with search/filter. Shareable links with permissions.

---

### 7B. Form View

**Database:**
```sql
CREATE TABLE forms (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint REFERENCES companies(id) ON DELETE CASCADE,
    project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    fields jsonb NOT NULL,
    settings jsonb DEFAULT '{}',
    public_slug text UNIQUE,
    is_active boolean DEFAULT true,
    submission_count integer DEFAULT 0,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Files:**
- `frontend/src/js/services/form-service.js`
- `frontend/src/js/pages/form-builder.js`
- `frontend/public/forms.html` — public form submission (no auth)

**UI:** Form builder: drag-and-drop field ordering, field type selector, preview. Public URL `/forms/{slug}` creates tasks from submissions.

---

### 7C. Import/Export

**Files:** `frontend/src/js/services/import-export-service.js`, `frontend/src/js/components/import-wizard.js`

**Features:** Export tasks as CSV/JSON (filtered by current view). Import from CSV: upload, map columns, preview, import. Project data export for backup.

---

### 7D. API and Webhooks (Edge Functions)

**Database:**
```sql
CREATE TABLE api_keys (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    permissions jsonb DEFAULT '["read"]',
    last_used_at timestamptz,
    expires_at timestamptz,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE webhooks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    url text NOT NULL,
    events text[] NOT NULL,
    secret text NOT NULL,
    is_active boolean DEFAULT true,
    last_triggered_at timestamptz,
    failure_count integer DEFAULT 0,
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);
```

**Edge Functions:** `api-tasks/index.ts` (REST API for CRUD), `webhooks/index.ts` (outgoing webhook delivery).

---

## PHASE 8: Polish, Performance & Mobile

### 8A. Dark Mode and Theming

**Files:** Modified `frontend/src/css/global.css` (dark CSS variables), new `frontend/src/js/utils/theme.js`, modified topbar (toggle button). Implementation: `[data-theme="dark"]` CSS variable overrides, `localStorage` persistence.

### 8B. Drag-and-Drop

**Files:** `frontend/src/js/utils/drag-drop.js` — reusable HTML5 DnD manager. Features: Kanban (status change), List/Table (reorder), Calendar (reschedule), Gantt (resize/move), Sidebar (reorder).

### 8C. Offline Support & Performance

**Files:** `frontend/src/js/utils/cache.js`, `frontend/service-worker.js`. Features: sessionStorage cache, optimistic UI updates, static asset caching, virtual scrolling for large lists.

### 8D. Responsive Design

**Files:** All CSS modified + new `frontend/src/css/responsive.css`. Breakpoints: >=1280px (full sidebar), 768-1279px (collapsed sidebar, compact views). Ensure all views (Board, List, Table, Calendar, Gantt) adapt gracefully to different screen widths. Sidebar collapses to icon-only mode on medium screens.

### 8E. Notification Preferences & Email

**Database:**
```sql
CREATE TABLE notification_preferences (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    email_enabled boolean DEFAULT true,
    email_frequency text DEFAULT 'instant',
    in_app_enabled boolean DEFAULT true,
    preferences jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

Edge Function for email delivery. Profile page gains "Notification Preferences" section.

---

## Phase Dependency Graph

```
Phase 1 (Foundation) ──────────────────────────┐
  1A Spaces ─┐                                  │
  1B Statuses ┤                                  │
  1C Subtasks ┤                                  │
  1D Dashboard┤                                  │
  1E Sidebar ─┘                                  │
       │                                         │
Phase 2 (Collaboration) ← depends on Phase 1    │
  2A Comments/Mentions                           │
  2B Activity Log                                │
  2C Notifications                               │
  2D Team Members & User Components               │
       │                                         │
Phase 3 (Views) ← depends on Phases 1, 2        │
  3A View Switcher                               │
  3B List View                                   │
  3C Table View                                  │
  3D Calendar ← needs 3A                         │
  3E Gantt ← needs 3A, 3D                        │
       │                                         │
Phase 4 (Advanced Tasks) ← depends on Phase 1   │
  4A Custom Fields                               │
  4B Tags                                        │
  4C Task Types/Templates                        │
  4D Multi-Assignee/Relationships                │
  4E Recurring Tasks                             │
  4F Time Tracking                               │
       │                                         │
Phase 5 (Reporting) ← depends on 2, 4           │
  5A Dashboard Widgets                           │
  5B Goals/Milestones                            │
  5C Workload View                               │
       │                                         │
Phase 6 (Power Features) ← depends on 3, 4      │
  6A Command Palette/Search                      │
  6B Keyboard Shortcuts                          │
  6C Advanced Filtering                          │
  6D Automation Engine                           │
       │                                         │
Phase 7 (Docs/Integrations) ← depends on 4      │
  7A Documents/Wiki                              │
  7B Form View                                   │
  7C Import/Export                               │
  7D API/Webhooks                                │
       │                                         │
Phase 8 (Polish) ← can run in parallel ─────────┘
  8A Dark Mode
  8B Drag-and-Drop
  8C Offline/Performance
  8D Responsive Design
  8E Email Notifications
```

---

## Summary

| Category | Count |
|----------|-------|
| New database tables | 25 |
| Modified existing tables | 3 (projects, tasks, profiles) |
| New HTML pages | 7 |
| New service files | 15 |
| New component files | 20+ |
| New view renderers | 5 |
| New utility files | 5 |
| New CSS files | 15+ |
| New Edge Functions | 2 |
| External library additions | 1 (Quill.js for docs, optional) |

## Implementation Conventions
1. **ID convention:** All new tables use `bigint GENERATED ALWAYS AS IDENTITY` for PKs (matching existing tables). User references are `uuid` (FK to auth.users). NEVER use `uuid` for business entity PKs.
2. **Service pattern:** Follow `project-service.js` — import supabase, import auth utils, export async functions with try/catch
3. **Page pattern:** Follow `projects.js` — `init()` calls `requireAuth()`, renders layout, loads data, `setupEventListeners()`
4. **Event delegation:** All dynamic elements use container-level listeners with `closest()` (never individual addEventListener)
5. **RLS on every table:** Company-scoped with `auth.is_system_admin()` and `auth.user_company_id()` helpers (in `auth` schema)
6. **Nullable company_id:** All content tables support personal users (company_id IS NULL)
7. **Migration naming:** `YYYYMMDD_NNN_descriptive_name.sql`
8. **CSS variables:** All colors/spacing via global custom properties, never hardcoded
9. **No framework dependencies:** Stays vanilla JS + Bootstrap 5 throughout
10. **Reuse existing functions:** `public.list_company_users()` for team member queries, `auth.user_company_id()` for RLS, `auth.is_system_admin()` for admin checks

## Testing Strategy
- Each phase requires its own Playwright test file
- Test RLS policies for every new table
- Test CRUD operations for every new service
- Test UI interactions for every new view/component
- Test multi-tenancy isolation on all new features
- Test keyboard shortcuts and command palette
- Test responsive breakpoints

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 04 (Navigation & Routing)
- Plan 05 (Project Management — existing)
