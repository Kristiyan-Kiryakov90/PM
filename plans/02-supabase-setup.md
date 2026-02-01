# 02 - Supabase Setup & Configuration

> **Status**: 🟡 Pending
> **Phase**: Phase 1 - Setup & Authentication
> **Dependencies**: [01-project-setup.md](./01-project-setup.md)

---

## 1. Overview

### Feature Description
Set up Supabase as the backend service, configure **multi-tenant architecture** with **invite-based authentication**, and create the Supabase client utility for use throughout the application. **All authentication is handled by Supabase Auth** with user metadata for company isolation.

### Goals
- Create new Supabase project in cloud dashboard
- Configure email/password authentication with invite-based registration
- Set up multi-tenancy with company-based data isolation
- Store user profile data in auth.users metadata (no separate users table)
- Store credentials securely in .env files (frontend and backend)
- Create reusable Supabase client modules
- Test connection to Supabase successfully

### User Value Proposition
Provides a complete managed backend (database, auth, storage) without writing server code, enabling rapid feature development.

### Prerequisites
- [x] [01-project-setup.md](./01-project-setup.md) - npm project initialized with dependencies

---

## 2. User Stories & Acceptance Criteria

### User Stories

**As a** developer
**I want to** connect to Supabase from the frontend
**So that** I can use authentication, database, and storage features

**As a** developer
**I want to** configure environment variables securely
**So that** credentials are not exposed in version control

### Acceptance Criteria

- [ ] Supabase project created in cloud dashboard
- [ ] Authentication provider (email/password) enabled with invite-based registration
- [ ] Frontend .env contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- [ ] Backend .env contains SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN
- [ ] Frontend Supabase client utility created at `frontend/src/js/services/supabaseClient.js`
- [ ] Backend Supabase config created at `backend/config/supabase.js`
- [ ] Clients can connect to Supabase successfully
- [ ] User metadata structure configured for multi-tenancy
- [ ] No credentials committed to Git

### Definition of Done

- [ ] Supabase project active
- [ ] Environment variables configured
- [ ] Supabase client module created and tested
- [ ] .env.example updated with instructions
- [ ] Changes committed to Git (without .env)

### Success Metrics

| Metric | Target |
|--------|--------|
| Connection success rate | 100% |
| Client initialization time | < 100ms |
| Auth setup time | < 5 minutes |

---

## 3. Database Requirements

### Supabase Project Configuration

**Project Settings:**
- **Organization**: Create new or use existing
- **Project Name**: taks-management (or your choice)
- **Database Password**: Strong password (save securely)
- **Region**: Choose closest to target users
- **Pricing Plan**: Free tier (sufficient for MVP)

### Authentication Configuration

**Enable Providers:**
- [x] Email/Password authentication (invite-based only)
- [ ] Google OAuth (optional, future enhancement)
- [ ] GitHub OAuth (optional, future enhancement)

**Important**: Registration is invite-only. Users cannot self-register without a valid invite token.

**Email Settings:**
- Confirmation emails: Auto-confirm in development, enabled in production
- Email templates: Use default templates initially
- Site URL: http://localhost:5173 (development, Vite)

**User Metadata Structure:**
```json
{
  "user_metadata": {
    "full_name": "John Doe",
    "company_id": "uuid-of-company",
    "avatar_url": "https://..."
  },
  "app_metadata": {
    "role": "user | company_admin | system_admin",
    "company_id": "uuid-of-company"
  }
}
```

**Roles:**
- `user`: Regular user (default)
- `company_admin`: Can manage company and invite users
- `system_admin`: Can manage all companies (platform admin)

### Row Level Security

RLS policies will enforce company-based isolation. See [03-database-schema.md](./03-database-schema.md) for detailed RLS policies.

**Key RLS Functions:**
- `auth.user_company_id()`: Returns user's company_id from JWT
- `auth.is_company_admin()`: Checks if user is admin
- `auth.is_system_admin()`: Checks if user is platform admin

---

## 4. Backend/Service Layer

### Service Module

**File**: `frontend/src/js/utils/supabase.js`

### Supabase Client Implementation

### Environment Variables Setup

**Update .env file:**

**Update .env.example:**

---

## 5. Frontend/UI Implementation

### Testing Connection (Optional Test Page)

Create a temporary test file to verify Supabase connection:

**File**: `frontend/src/js/test-supabase.js`

**Add to index.html temporarily:**

---

## 6. Security Considerations

### Environment Variables Security

- [ ] .env file is in .gitignore
- [ ] .env.example has no real credentials
- [ ] Never commit actual Supabase keys to Git
- [ ] Use anon key for client-side (not service_role key)

### Supabase API Keys

**Two types of keys:**
1. **anon (public)** - Safe to use client-side, respects RLS
2. **service_role** - NEVER use client-side, bypasses RLS

**Always use anon key in frontend code.**

### CORS Configuration

Supabase automatically handles CORS. No additional configuration needed for localhost:3000.

For production deployment:
- Add production URL to Supabase Authentication settings > Site URL
- Add production domain to Authentication settings > Redirect URLs

---

## 7. Implementation Steps

### Step 1: Create Supabase Project
- [ ] Go to [Supabase Dashboard](https://app.supabase.com)
- [ ] Create new project (name: taks-management)
- [ ] Choose region and set database password
- [ ] Wait for project provisioning (~2 minutes)

### Step 2: Configure Authentication
- [ ] Navigate to Authentication > Providers
- [ ] Enable Email provider
- [ ] Set Site URL to `http://localhost:5173`
- [ ] Disable email confirmation for development (optional)

### Step 3: Get API Credentials
- [ ] Go to Project Settings > API
- [ ] Copy Project URL (SUPABASE_URL)
- [ ] Copy anon public key (SUPABASE_ANON_KEY)
- [ ] Copy service_role key (SUPABASE_SERVICE_ROLE_KEY)
- [ ] Get access token from Project Settings > Access Tokens (SUPABASE_ACCESS_TOKEN)

### Step 4: Configure Environment Variables

**Frontend `.env`:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Backend `.env`:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ACCESS_TOKEN=your-access-token-here
```

### Step 5: Create Supabase Client Modules

**Frontend**: `frontend/src/js/services/supabaseClient.js`
**Backend**: `backend/config/supabase.js` (already exists)

### Step 6: Test Connection
- [ ] Test frontend client connection
- [ ] Test backend client connection
- [ ] Verify authentication works

---

## 9. Related Specs

### Dependencies (Must Complete First)

- [x] [01-project-setup.md](./01-project-setup.md) - Need npm project with @supabase/supabase-js installed

### Depends On This (Blocked Until Complete)

- [03-database-schema.md](./03-database-schema.md) - Needs Supabase project to create tables
- [04-authentication.md](./04-authentication.md) - Needs Supabase client for auth functions
- [06-project-management.md](./06-project-management.md) - Needs Supabase client for database queries
- [07-task-management.md](./07-task-management.md) - Needs Supabase client for database queries
- [09-file-storage.md](./09-file-storage.md) - Needs Supabase client for storage operations

### Related Features (Integration Points)

- All service modules will import from `utils/supabase.js`
- Authentication state will use Supabase session management
- Database operations will use Supabase client methods

### Documentation References

- [Supabase Documentation](https://supabase.com/docs) - Official docs
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction) - Client library reference
- [Project Summary](../ai-docs/project-summary.md) - Tech stack decisions
- [Security Practices](../ai-docs/security.md) - Environment variable security

---

## Appendix

### Useful Resources

- [Supabase Dashboard](https://app.supabase.com) - Project management
- [Supabase Status](https://status.supabase.com/) - Service status
- [Supabase Discord](https://discord.supabase.com/) - Community support

### Notes & Considerations

- Free tier includes: 500MB database, 1GB file storage, 50MB file uploads
- Supabase handles connection pooling automatically
- Real-time subscriptions available (not needed for MVP)
- Automatic API generation for database tables

### Future Enhancements

- [ ] Add social auth providers (Google, GitHub) with company linking
- [ ] Configure custom email templates for invites
- [ ] Set up custom domain for authentication emails
- [ ] Add real-time subscriptions for live updates
- [ ] Configure backup and recovery strategy
- [ ] Email domain whitelisting for auto-approval
- [ ] SSO/SAML integration for enterprise customers
- [ ] Custom branding per company
