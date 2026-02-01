# Plan 02: Build System & Configuration

## Objective
Set up Vite build system, project structure, environment configuration, and Supabase client.

## What's Needed

**Files:**
- `.env` (project root) - Supabase credentials
- `.env.example` - Template for env vars
- `frontend/package.json` - Dependencies (Vite, Supabase JS, Bootstrap)
- `frontend/vite.config.js` - Multi-page config with path aliases
- `frontend/src/js/services/supabase.js` - Singleton Supabase client
- `frontend/src/js/utils/auth.js` - Auth helper functions
- `frontend/src/css/global.css` - Shared global styles
- `frontend/src/css/[page].css` - Page-specific CSS for each HTML page

**Directory Structure:**
- `frontend/public/` - HTML files
- `frontend/src/js/services/` - Data access layer
- `frontend/src/js/components/` - Reusable UI components
- `frontend/src/js/pages/` - Page-specific logic
- `frontend/src/js/utils/` - Shared utilities
- `frontend/src/css/` - Styles
- `frontend/src/assets/` - Static assets

**Functionality:**
- Vite dev server serves multi-page app
- Supabase client connects to database
- Environment variables loaded from project root `.env`
- Path aliases for cleaner imports (@services, @utils, etc.)
- Bootstrap 5 CSS loaded

## Testing
- `npm run dev` starts server without errors
- Supabase client can query database
- Environment variables accessible
- Bootstrap CSS loaded
- Build completes successfully

## Dependencies
- Plan 01 (Database Setup)
