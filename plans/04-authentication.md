# 04 - Authentication System

> **Status**: 🟡 Pending
> **Phase**: Phase 1 - Setup & Authentication
> **Dependencies**: [02-supabase-setup.md](./02-supabase-setup.md), [03-database-schema.md](./03-database-schema.md)

---

## 1. Overview

### Feature Description
Implement complete user authentication system including landing page, registration, login, logout, and session management. **Authentication is handled entirely by Supabase Auth** - no custom authentication logic needed.

### Goals
- Create landing page with app information
- Build a combined auth page with login and registration forms
- Create auth service module for reusable auth functions
- Implement session management and persistence
- Add navigation guards for protected pages

### User Value Proposition
Secure user authentication allows personalized project and task management with proper access control.

### Prerequisites
- [x] [02-supabase-setup.md](./02-supabase-setup.md) - Supabase client configured
- [x] [03-database-schema.md](./03-database-schema.md) - Users table created

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** new user
**I want to** register with email and password
**So that** I can create an account and start managing projects

**As a** returning user
**I want to** log in with my credentials
**So that** I can access my projects and tasks

**As a** logged-in user
**I want to** stay logged in across sessions
**So that** I don't have to re-enter credentials every time

**As a** user
**I want to** log out securely
**So that** no one else can access my account on shared devices

**As a** first-time setup admin
**I want to** create the initial admin account from the landing page
**So that** the system has an administrator (one-time setup)

### Acceptance Criteria

**Authentication:**
- [ ] Landing page displays app features and a clear call-to-action to sign in
- [ ] Auth page supports both registration and login in one place
- [ ] Registration form validates input and creates account
- [ ] User metadata (full_name) saved during registration
- [ ] Login form authenticates users successfully
- [ ] Invalid credentials show appropriate error messages
- [ ] Session persists across page reloads
- [ ] Logout clears session and redirects to landing page
- [ ] Protected pages redirect unauthenticated users to the auth page

**Admin Setup (First-time only):**
- [ ] "Create Admin User" button visible on landing page initially
- [ ] Button opens modal with email/password form
- [ ] Edge function creates admin with is_admin=true in app_metadata
- [ ] Edge function only works if NO admins exist yet
- [ ] Button permanently hidden after first admin is created
- [ ] Admin users redirect to admin dashboard after login
- [ ] Regular users redirect to regular dashboard after login

### Definition of Done

- [ ] Both pages created (landing and combined auth)
- [ ] Auth service module implemented
- [ ] All user flows tested manually
- [ ] Error handling works correctly
- [ ] Session persistence verified
- [ ] Navigation guards implemented
- [ ] Code committed to Git

### Success Metrics

| Metric | Target |
|--------|--------|
| Registration success rate | > 95% |
| Login success rate | > 98% |
| Session persistence | 100% |
| Page load time | < 2 seconds |

---

## 3. Database Requirements

### User Profile Storage

**User profiles are stored in Supabase Auth, NOT in a separate table:**

- **`user_metadata`**: Stores profile data
  
- **`app_metadata`**: Stores admin flag (set via Edge Function or Supabase Dashboard)
  
**No additional database tables needed for user profiles.**

---

## 4. Backend/Service Layer

### Edge Function for Admin Creation

**File**: `backend/supabase/functions/create-admin/index.ts`

### Service Module

**File**: `frontend/src/js/services/auth.js`

### Function Signatures

---

## 5. Frontend/UI Implementation

### Pages Involved

| Page | File Path | Purpose |
|------|-----------|---------|
| Landing | `frontend/public/index.html` | Main marketing/advertising page that presents the app |
| Auth | `frontend/public/auth.html` | Combined login and registration page with toggle/segmented forms |

### UI Layout Description

#### Landing Page (index.html)

**Layout Structure:**

#### Auth Page (auth.html)

**Layout Structure:**

### Bootstrap Components Used

| Component | Usage | Classes |
|-----------|-------|---------|
| Navbar | Landing page navigation | `navbar`, `navbar-expand-lg`, `navbar-light`, `bg-light` |
| Card | Login/Register forms | `card`, `card-body`, `shadow` |
| Form | Input fields | `form-control`, `form-label`, `mb-3` |
| Button | Submit buttons | `btn`, `btn-primary`, `w-100` |
| Alert | Error messages | `alert`, `alert-danger` |
| Spinner | Loading state | `spinner-border`, `spinner-border-sm` |
| Container | Page layout | `container`, `mt-5` |

### Form Fields & Validation

#### Register Form

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| full_name | text | Yes | Min 2 characters |
| email | email | Yes | Valid email format |
| password | password | Yes | Min 6 characters |
| confirm_password | password | Yes | Must match password |

**Validation Logic:**

#### Login Form

| Field | Type | Required | Validation Rules |
|-------|------|----------|------------------|
| email | email | Yes | Valid email format |
| password | password | Yes | Not empty |

### JavaScript Interactions

#### Auth Page Event Handlers

- Handle form toggle (login vs register) without navigation
- Submit register form to Supabase `signUp`
- Submit login form to Supabase `signInWithPassword`
- Share error and loading state UI between both forms

#### Landing Page Admin Creation

---

## 6. Security Considerations

### Input Validation

- [ ] Client-side validation for all form fields
- [ ] Email format validation
- [ ] Password minimum length (6 characters)
- [ ] Password confirmation match
- [ ] XSS prevention: Never use innerHTML with user input

### Authentication Security

**All authentication is handled by Supabase Auth:**
- [ ] Passwords hashed and stored by Supabase (never in frontend)
- [ ] Session tokens managed securely by Supabase client
- [ ] JWT tokens signed and verified by Supabase
- [ ] Password reset handled by Supabase email flows
- [ ] HTTPS required in production
- [ ] Email confirmation can be enabled in Supabase settings
- [ ] No custom authentication logic needed

### Session Management

---

## 7. Implementation Steps

- [ ] Outline database changes (tables, indexes, RLS)
- [ ] Define service layer functions and error handling
- [ ] Describe UI updates and required pages/components
- [ ] List integration touchpoints and config updates
- [ ] Note validation and edge cases to handle

---

## 9. Related Specs

### Dependencies (Must Complete First)

- [x] [02-supabase-setup.md](./02-supabase-setup.md) - Supabase client needed for auth
- [x] [03-database-schema.md](./03-database-schema.md) - Users table and trigger needed

### Depends On This (Blocked Until Complete)

- [05-dashboard.md](./05-dashboard.md) - Needs authentication to show user data
- [06-project-management.md](./06-project-management.md) - Needs user session
- [07-task-management.md](./07-task-management.md) - Needs user session
- [08-task-assignment.md](./08-task-assignment.md) - Needs user data
- [09-file-storage.md](./09-file-storage.md) - Needs authenticated user
- [10-admin-panel.md](./10-admin-panel.md) - Needs role-based auth

### Related Features (Integration Points)

- All protected pages will use `requireAuth()` guard
- User session will be checked across all pages
- Logout functionality will be in navigation menu

### Documentation References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Project Summary](../ai-docs/project-summary.md) - Authentication requirements
- [Security Practices](../ai-docs/security.md) - Auth security best practices

---

## Appendix

### Useful Resources

- [Supabase Auth API Reference](https://supabase.com/docs/reference/javascript/auth-signup)
- [Bootstrap Forms](https://getbootstrap.com/docs/5.3/forms/overview/)
- [Bootstrap Validation](https://getbootstrap.com/docs/5.3/forms/validation/)

### Notes & Considerations

- Email confirmation is optional (can be enabled in Supabase settings)
- Password reset can be added as a future enhancement
- Social auth (Google, GitHub) can be added later
- MFA (Multi-Factor Authentication) available in Supabase

### Future Enhancements

- [ ] Add password reset functionality
- [ ] Add email confirmation requirement
- [ ] Add social auth providers (Google, GitHub)
- [ ] Add "Remember Me" checkbox
- [ ] Add profile picture upload during registration
- [ ] Implement MFA for enhanced security
