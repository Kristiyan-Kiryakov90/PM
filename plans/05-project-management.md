# Plan 05: Project Management

## Objective
Implement full CRUD operations for projects with company-scoped access.

## What's Needed

**Files:**
- `frontend/src/js/services/project-service.js` - Project CRUD operations
- `frontend/src/js/pages/projects.js` - Projects page logic
- `frontend/public/projects.html` - Complete UI
- `frontend/src/css/projects.css` - Page-specific styles

**Functionality:**

**Project Service:**
- getProjects - List all projects in user's company
- getProject - Get single project by ID
- createProject - Create new project (name, description, status)
- updateProject - Update project details
- deleteProject - Delete project (with confirmation)

**Projects Page:**
- Display all projects in company
- Create new project modal/form
- Edit project (inline or modal)
- Delete project with confirmation
- Filter/sort projects by status
- Show project stats (task count, status)

**Validation:**
- Required fields (name)
- Company isolation (can't create in other company)
- Ownership checks (owner or admin can edit/delete)

## Testing
- Can create new project
- Projects list shows only company projects
- Can edit own projects
- Can delete projects
- Multi-tenant isolation works (can't see other company's projects)
- Validation prevents invalid data
- RLS policies enforced

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
- Plan 03 (Authentication System)
- Plan 04 (Navigation & Routing)
