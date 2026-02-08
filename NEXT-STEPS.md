# 🚀 Next Steps - Plan 06: Task Management

**Current Status:** Plans 01-05 Complete ✅
**Overall Progress:** 56% (5/9 plans)
**Next Focus:** Task Management (Plan 06)

---

## 📋 Overview

Now that navigation and project management are complete, it's time to implement the task management system. This will allow users to:
- Create, read, update, delete tasks
- Organize tasks in a Kanban board
- Filter tasks by status, priority, assignee
- Track task progress

---

## 🏗️ Architecture

### Similar Pattern to Projects
The task system will follow the same architecture as projects:

```
1. Task Service (task-service.js)
   ├── getTasks()           → List company tasks
   ├── getTask(id)          → Get single task
   ├── createTask(data)     → Create new task
   ├── updateTask(id, data) → Update task
   ├── deleteTask(id)       → Delete task
   ├── getTaskStats()       → Get statistics
   └── canModifyTask(id)    → Check permissions

2. Tasks Page (tasks.js + tasks.html)
   ├── loadTasks()
   ├── renderTasks()        → Kanban board layout
   ├── setupEventListeners()
   ├── setupModals()
   └── handleInteractions()

3. Task Modals
   ├── Create task modal
   ├── Edit task modal
   ├── Delete confirmation modal
   └── Task details view

4. Kanban Board
   ├── 4 columns: To Do, In Progress, Review, Done
   ├── Drag-and-drop support (future)
   ├── Task cards with: title, priority, assignee, due date
   └── Inline actions: edit, delete, change status
```

---

## 📝 Task Fields

Each task will have:

```javascript
{
  id: UUID,
  project_id: UUID,           // Which project
  company_id: UUID,           // For RLS isolation
  title: string,              // Task name (required, max 200 chars)
  description: string,        // Detailed description (optional)
  status: enum,               // 'todo' | 'in_progress' | 'review' | 'completed'
  priority: enum,             // 'low' | 'medium' | 'high'
  assigned_to: UUID,          // Team member (optional)
  due_date: date,             // Due date (optional)
  created_by: UUID,           // Who created it
  created_at: timestamp,      // When created
  updated_at: timestamp       // Last updated
}
```

---

## 🎯 Implementation Plan

### Step 1: Create Task Service (Day 1)
```javascript
// frontend/src/js/services/task-service.js
- getTasks(projectId?)        // List tasks (all or per project)
- getTask(id)
- createTask(data)
- updateTask(id, data)
- deleteTask(id)
- updateTaskStatus(id, status)
- getTaskStats(projectId?)
- canModifyTask(id)
```

**Validation:**
- Title required (max 200 chars)
- Description optional (max 1000 chars)
- Status must be valid enum
- Priority must be valid enum
- Due date should be future
- Assigned user must exist in company

---

### Step 2: Update Tasks Page HTML
```html
<!-- Already partially structured in tasks.html -->
<!-- Add/update:
- Filter bar: project, status, priority, assignee, search
- Kanban board layout with 4 columns
- Task modals (create, edit, delete)
- Task cards with all fields
- Empty states per column
```

---

### Step 3: Create Tasks Page Logic
```javascript
// frontend/src/js/pages/tasks.js
- Same pattern as projects.js
- Load tasks from API
- Render Kanban board
- Handle create/edit/delete
- Filter and search
- Status transitions
```

---

### Step 4: Update Tasks CSS
```css
// Enhance frontend/src/css/tasks.css
- Kanban board columns (4 columns)
- Task cards with priorities
- Filter bar styling
- Status colors and badges
- Drag-and-drop styles (if implementing)
- Responsive grid collapse
```

---

## 🎨 UI Design

### Filter Bar
```html
<select>Project</select>
<select>Status (All, Todo, In Progress, Review, Done)</select>
<select>Priority (All, Low, Medium, High)</select>
<select>Assigned To</select>
<input>Search by title</input>
```

### Kanban Board
```
┌─────────────┬──────────────┬─────────┬──────┐
│   To Do     │ In Progress  │ Review  │ Done │
├─────────────┼──────────────┼─────────┼──────┤
│ ┌─────────┐ │ ┌────────┐  │┌──────┐│      │
│ │Task 1   │ │ │Task 5  │  ││Task8 ││      │
│ │High ⭐  │ │ │Med ⭐⭐ │  ││Done  ││      │
│ └─────────┘ │ └────────┘  │└──────┘│      │
│ ┌─────────┐ │ ┌────────┐  │        │      │
│ │Task 2   │ │ │Task 6  │  │        │      │
│ │Low ⭐   │ │ │Med ⭐⭐ │  │        │      │
│ └─────────┘ │ └────────┘  │        │      │
└─────────────┴──────────────┴─────────┴──────┘
```

### Task Card
```html
<div class="task-card">
  <h4>Task Title</h4>
  <p>Description preview...</p>
  <div class="task-meta">
    <span class="priority high">High</span>
    <span class="status">In Progress</span>
    <span class="assignee">👤 John Doe</span>
  </div>
  <div class="task-footer">
    <span class="due-date">📅 Feb 15</span>
    <button class="edit">Edit</button>
    <button class="delete">Delete</button>
  </div>
</div>
```

---

## ✅ Checklist

### Must Have
- [ ] Task CRUD service
- [ ] Tasks page with Kanban board
- [ ] Create task modal
- [ ] Edit task modal
- [ ] Delete task confirmation
- [ ] Filter by status
- [ ] Filter by project
- [ ] Search by title
- [ ] Company isolation
- [ ] Form validation
- [ ] Error handling

### Nice to Have
- [ ] Filter by priority
- [ ] Filter by assignee
- [ ] Due date picker
- [ ] Bulk operations
- [ ] Task comments/activity
- [ ] Drag-and-drop reordering
- [ ] Task templates

### Future
- [ ] Time tracking
- [ ] Task dependencies
- [ ] Recurring tasks
- [ ] Custom fields
- [ ] Task history/audit log

---

## 📊 Estimated Effort

| Component | LOC | Time |
|-----------|-----|------|
| Task Service | ~250 | 1h |
| Tasks Page Logic | ~300 | 2h |
| Tasks Page HTML | ~100 | 30m |
| Tasks CSS Updates | ~150 | 1h |
| Testing & Debug | - | 1h |
| **Total** | **~800** | **~5h** |

---

## 🔗 Dependencies

- ✅ Plan 01: Database (tasks table exists)
- ✅ Plan 02: Build system
- ✅ Plan 03: Authentication
- ✅ Plan 04: Navigation
- ✅ Plan 05: Projects (tasks linked to projects)

No new dependencies needed!

---

## 🎮 How to Test

```javascript
// After implementation, test:

1. Create task
   - Minimal: Just title
   - Full: All fields
   - With project selection
   - Validation (required fields)

2. List tasks
   - All tasks load
   - Filtered by project
   - Filtered by status
   - Searched by title
   - Company isolation

3. Edit task
   - Change title
   - Change status
   - Change priority
   - Change assignee
   - Update due date

4. Delete task
   - Confirmation dialog
   - Task removed from board
   - No orphan data

5. Kanban board
   - Tasks in correct columns
   - Drag between columns (if implemented)
   - Empty state per column
   - Count badges
```

---

## 📚 Reference Files

When implementing, reference:
- `frontend/src/js/services/project-service.js` (similar service)
- `frontend/src/js/pages/projects.js` (similar page logic)
- `frontend/public/projects.html` (modal patterns)
- `frontend/src/css/projects.css` (card styling)

---

## 🚦 Quick Start

```bash
# 1. Start with task service
touch frontend/src/js/services/task-service.js

# 2. Add task page logic
touch frontend/src/js/pages/tasks.js

# 3. Run dev server to test
cd frontend && npm run dev

# 4. Test in browser
# - Create a project first
# - Go to /public/tasks.html
# - Create tasks in that project
```

---

## 💡 Pro Tips

1. **Test Company Isolation:** Make sure RLS policies work - tasks from other companies shouldn't show
2. **Use Bootstrap Modals:** Keep consistency with projects page modals
3. **Follow Project Pattern:** Task service mirrors project service - easier to understand
4. **Validate Everything:** Same validation rules as projects (required fields, max lengths)
5. **Test Filtering:** Make sure filters don't break with empty project selection
6. **Toast Notifications:** Use `showSuccess()`, `showError()` from ui-helpers

---

## 📞 Questions?

Reference these files:
- `PLAN-04-AND-05-SUMMARY.md` - How projects were implemented
- `plans/06-task-management.md` - Full requirements
- `CLAUDE.md` - Project overview

---

## 🎯 Success Criteria

After Plan 06, you should have:
- ✅ Full task CRUD functionality
- ✅ Kanban board with 4 status columns
- ✅ Task filtering and search
- ✅ Company-scoped data isolation
- ✅ Form validation
- ✅ Error handling
- ✅ Modern UI matching design system
- ✅ Mobile responsive

**Ready to start?** Create the task service first, then build out from there!

---

**Estimated Timeline:** 5-6 hours
**Difficulty Level:** Medium (follows project pattern)
**Next Phase After:** Plan 07 (Attachments)

Let's build! 🚀
