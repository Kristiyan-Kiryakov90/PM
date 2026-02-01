# Plan 03: Authentication System

## Objective
Implement complete authentication: bootstrap modal for first sys_admin, standard registration, invite-based registration, and login.

## What's Needed

**Files:**
- `frontend/public/index.html` - Landing page with bootstrap modal
- `frontend/src/js/pages/index.js` - Bootstrap modal logic
- `frontend/public/signup.html` - Registration page (standard + invite forms)
- `frontend/src/js/pages/signup.js` - Registration logic
- `frontend/public/signin.html` - Login page
- `frontend/src/js/pages/signin.js` - Login logic
- `frontend/src/js/services/auth-service.js` - Auth business logic
- `frontend/src/js/utils/validation.js` - Input validation functions
- `frontend/src/js/utils/router.js` - Route guards (requireAuth, requireRole)

**Functionality:**

**Bootstrap Flow:**
- Check if sys_admin exists on index.html load
- Show modal if none exists
- Create company + first sys_admin user
- Store role='sys_admin' and company_id in user metadata

**Standard Registration:**
- Create new company
- Create user with role='user'
- Set company_id in user metadata

**Invite Registration:**
- Validate invite token (pending, not expired)
- Create user with role from invite
- Mark invite as accepted

**Login:**
- Sign in with email/password
- Redirect based on role (admin → admin.html, user → dashboard.html)

**Route Guards:**
- requireAuth - redirect to signin if not logged in
- requireRole - redirect if user doesn't have required role

## Testing
- Bootstrap modal shows only when no sys_admin exists
- Can create sys_admin with company
- Standard signup creates company + user
- Invite signup validates token and assigns correct role
- Login redirects based on role
- Route guards block unauthorized access
- Session persists after page refresh

## Dependencies
- Plan 01 (Database Setup)
- Plan 02 (Build System & Configuration)
