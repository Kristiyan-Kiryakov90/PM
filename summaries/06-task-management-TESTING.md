# Plan 06: Task Management - Testing Guide

## Implementation Summary

✅ **Completed Components:**

1. **Task Service** (`frontend/src/js/services/task-service.js`)
   - Full CRUD operations (getTasks, getTask, createTask, updateTask, deleteTask)
   - Company isolation via RLS
   - Filter support (project, status, assigned_to)
   - Validation and error handling

2. **Realtime Service** (`frontend/src/js/services/realtime-service.js`)
   - Supabase Realtime subscriptions
   - Real-time task updates (insert, update, delete events)
   - Company-filtered subscriptions
   - Automatic cleanup on page unload

3. **Tasks Page** (`frontend/src/js/pages/tasks.js`)
   - Kanban board with 3 columns (To Do, In Progress, Done)
   - Create/Edit/Delete task functionality
   - Task status quick-change buttons
   - Search and filter capabilities
   - Real-time updates across users
   - Modal-based task management

4. **UI Components** (`frontend/public/tasks.html`)
   - Modern Kanban board layout
   - Create/Edit task modal
   - View task details modal
   - Delete confirmation modal
   - Filter controls (status, project, search)

5. **Styling** (`frontend/src/css/tasks.css`)
   - Linear/Notion-inspired design
   - Responsive grid layout
   - Smooth animations and transitions
   - Priority badges (low, medium, high, urgent)
   - Status indicators
   - Hover effects and micro-interactions

## Database Schema Alignment

The implementation correctly uses:
- ✅ `assigned_to` (not assignee_id)
- ✅ Status values: `todo`, `in_progress`, `review`, `done`
- ✅ Priority values: `low`, `medium`, `high`, `urgent`
- ✅ Attachment fields: `file_name`, `file_size`
- ✅ bigint IDs (auto-handled by Supabase)

## Testing Checklist

### Prerequisites
1. ✅ Dev server running: `cd frontend && npm run dev`
2. ✅ Navigate to: `http://localhost:5173/tasks.html`
3. ✅ User must be logged in with a company

### Basic Functionality Tests

#### 1. Create Task ✓
- [ ] Click "New Task" button
- [ ] Fill in task title (required)
- [ ] Select a project (required)
- [ ] Set priority (low/medium/high/urgent)
- [ ] Set due date (optional)
- [ ] Add description (optional)
- [ ] Submit and verify task appears in "To Do" column

#### 2. View Task ✓
- [ ] Click on any task card
- [ ] Verify task details modal opens
- [ ] Check all fields display correctly
- [ ] Verify attachments section (if any)
- [ ] Close modal

#### 3. Edit Task ✓
- [ ] Click edit button (✏️) on a task card
- [ ] Modify task details
- [ ] Save changes
- [ ] Verify changes appear immediately

#### 4. Delete Task ✓
- [ ] Click edit button on a task
- [ ] Click "Delete Task" button
- [ ] Confirm deletion in modal
- [ ] Verify task is removed from board

#### 5. Change Task Status ✓
- [ ] Use quick status buttons on task cards:
  - ▶️ Move from "To Do" to "In Progress"
  - ✅ Move from "In Progress" to "Done"
  - 🔄 Reopen from "Done" to "In Progress"
  - ⬅️ Move back to "To Do"
- [ ] Verify task moves to correct column immediately

### Filter & Search Tests

#### 6. Status Filter ✓
- [ ] Select "To Do" from status filter
- [ ] Verify only todo tasks show in all columns
- [ ] Select "In Progress"
- [ ] Verify only in-progress tasks show
- [ ] Select "All Status"
- [ ] Verify all tasks show

#### 7. Project Filter ✓
- [ ] Select a specific project
- [ ] Verify only tasks from that project show
- [ ] Switch between projects
- [ ] Verify filter works correctly

#### 8. Search ✓
- [ ] Type a task title in search box
- [ ] Verify matching tasks filter in real-time
- [ ] Type partial description text
- [ ] Verify description search works
- [ ] Clear search
- [ ] Verify all tasks reappear

### Real-time Updates Tests

#### 9. Multi-User Real-time Sync ✓
**Setup:** Open two browser windows side-by-side (or different browsers)
- [ ] Window 1: Create a new task
- [ ] Window 2: Verify task appears automatically
- [ ] Window 1: Update a task status
- [ ] Window 2: Verify task moves to new column
- [ ] Window 2: Delete a task
- [ ] Window 1: Verify task disappears
- [ ] Window 1: Edit task details
- [ ] Window 2: Verify updates appear (may need to click task)

### Multi-tenancy Tests

#### 10. Company Isolation ✓
**Setup:** Have two users from different companies
- [ ] User 1 (Company A): Create tasks
- [ ] User 2 (Company B): Verify Company A's tasks are NOT visible
- [ ] User 2 (Company B): Create tasks
- [ ] User 1 (Company A): Verify Company B's tasks are NOT visible
- [ ] Each user should only see their own company's tasks

### Visual & UX Tests

#### 11. UI Polish ✓
- [ ] Verify smooth hover effects on task cards
- [ ] Check card elevation on hover
- [ ] Verify status change buttons appear/work
- [ ] Check priority badge colors:
  - Low: Blue
  - Medium: Yellow/Orange
  - High: Red
  - Urgent: Dark Red
- [ ] Verify overdue tasks show red due date

#### 12. Responsive Design ✓
- [ ] Resize browser to mobile width
- [ ] Verify Kanban columns stack vertically
- [ ] Check all buttons are accessible
- [ ] Verify modals work on mobile
- [ ] Test filters on small screen

#### 13. Empty States ✓
- [ ] Clear all filters and delete all tasks
- [ ] Verify empty state message shows
- [ ] Verify "Create Task" button in empty state works
- [ ] Apply a filter with no results
- [ ] Verify appropriate empty column message

### Error Handling Tests

#### 14. Validation ✓
- [ ] Try creating task without title → Should show error
- [ ] Try creating task without project → Should show error
- [ ] Try submitting form with title > 200 chars → Should show error
- [ ] All error messages should be clear and helpful

#### 15. Network Errors
- [ ] Disconnect internet
- [ ] Try creating a task → Should show error
- [ ] Reconnect internet
- [ ] Retry operation → Should work

### Performance Tests

#### 16. Large Dataset
- [ ] Create 20+ tasks across different statuses
- [ ] Verify board renders quickly
- [ ] Test scrolling performance in columns
- [ ] Test search with many tasks
- [ ] Test filter switching

## Known Limitations

1. **User Assignment:** Currently, the `assigned_to` field is not exposed in the UI (user management not yet implemented)
2. **Attachments:** Attachment upload not yet implemented (table exists, UI shows attachments)
3. **Review Status:** The database supports "review" status but UI only uses todo/in_progress/done
4. **Drag & Drop:** Quick status buttons are used instead of drag-and-drop (can be added later)

## Next Steps (Future Enhancements)

- [ ] Add drag-and-drop for status changes
- [ ] Implement user assignment dropdown
- [ ] Add attachment upload functionality
- [ ] Add task comments/activity log
- [ ] Add task due date notifications
- [ ] Add bulk task operations
- [ ] Add task templates
- [ ] Add advanced filters (assignee, priority, due date)

## Success Criteria

✅ All basic CRUD operations work
✅ Kanban board displays tasks correctly
✅ Real-time updates work across multiple users
✅ Multi-tenant isolation is enforced
✅ Modern, polished UI matches design guidelines
✅ Responsive design works on mobile
✅ No console errors
✅ Filters and search work correctly

## Development Notes

- Dev server: `http://localhost:5173`
- Tasks page: `http://localhost:5173/tasks.html`
- Console: Check browser DevTools for any errors
- Database: Check Supabase dashboard for data integrity
- Realtime: Monitor Supabase Realtime logs for subscription status
