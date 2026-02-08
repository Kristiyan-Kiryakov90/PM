# Plan 03: Authentication System

## Status: ✅ IMPLEMENTED

## Overview
Complete authentication with bootstrap (first sys_admin), registration (company + user), and login.

## What Was Built

### Frontend Pages
- ✅ `index.html` - Landing page with bootstrap modal (shows only if no sys_admin)
- ✅ `signup.html` - Registration with optional company creation
- ✅ `signin.html` - Login page
- ✅ `dashboard.html` - User dashboard (protected)
- ✅ `admin.html` - Admin panel (protected)

### Authentication Services
- ✅ `auth-service.js` - Sign up, sign in, bootstrap logic
- ✅ `auth.js` - User metadata, role checks, profile queries
- ✅ `router.js` - Route guards (requireAuth, requireRole, requireAdmin)
- ✅ `validation.js` - Email, password, field validation

### Database & Security
- ✅ `profiles` table - Maps users to companies (one row per company user)
- ✅ RLS policies - Multi-tenant isolation on all tables
- ✅ Helper functions - `user_company_id()`, `is_company_admin()`, `is_system_admin()`
- ✅ Triggers - Auto-create profiles on user signup

### Backend Services
- ✅ Edge Function `admin-create-user` - Create users with service role
- ✅ RPC Functions:
  - `signup_with_optional_company()` - Company creation during signup
  - `validate_admin_can_create_user()` - Admin permission validation
  - `rollback_company_creation()` - Cleanup on signup failure

## Flows

**Bootstrap:** No sys_admin → Show modal → Create company + sys_admin user

**Signup:** Enter company name (optional) → Create user → Auto-login → Redirect to dashboard

**Signin:** Email/password → Establish session → Redirect to dashboard

**Session:** Auto-restore from localStorage on page load

## Not Implemented
- Invite-based registration (future enhancement)
- Email verification workflow (skipped for local dev)
- Password reset flow

## Dependencies
- Plan 01 (Database)
- Plan 02 (Build System)
