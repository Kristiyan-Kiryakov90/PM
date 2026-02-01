# Plan 04: Navigation & Routing

## Objective
Create shared navigation component and page structure for all protected pages.

## What's Needed

**Files:**
- `frontend/src/js/components/navbar.js` - Shared navbar component
- `frontend/src/js/utils/ui-helpers.js` - Loading states, error/success messages
- `frontend/src/js/utils/error-handler.js` - Centralized error handling

**Pages (minimal structure):**
- `frontend/public/dashboard.html`
- `frontend/public/projects.html`
- `frontend/public/tasks.html`
- `frontend/public/admin.html`
- `frontend/public/profile.html`

**Functionality:**

**Navbar Component:**
- Show links: Dashboard, Projects, Tasks, Profile, Sign Out
- Show Admin link only for admin/sys_admin roles
- Handle sign out (clear session, redirect to signin)
- Render dynamically based on current user

**UI Helpers:**
- showLoading - Display loading spinner
- showError - Show error alert message
- showSuccess - Show success alert message

**Error Handler:**
- Centralized error handling for all async operations
- Map Supabase errors to user-friendly messages
- No stack traces visible to users

**Page Pattern:**
- Each page calls requireAuth on init
- Each page renders navbar
- Each page has loading/error states
- Each page has its own CSS file (e.g., dashboard.html → dashboard.css)

## Testing
- Navbar renders correctly with role-based links
- Navigation works between all pages
- Sign out clears session and redirects
- Admin link visible only to admins
- Loading states show during async operations
- Error messages display user-friendly text

## Dependencies
- Plan 03 (Authentication System)
