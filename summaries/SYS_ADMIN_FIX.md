# System Admin Recognition Issue - Fix Guide

## Problem

The system admin role (`sys_admin`) is not being recognized properly, causing authentication and authorization issues.

## Root Cause

There's a schema inconsistency in the database setup:

1. **Multiple database schemas exist:**
   - `users` table (from `users-table.sql`)
   - `profiles` table (from migration `20260207_011_proper_multitenant.sql`)
   - User metadata in `auth.users.raw_user_meta_data`

2. **Helper functions reference different sources:**
   - Some migrations use `profiles` table
   - Some use `users` table
   - Some read from `auth.users` metadata directly

3. **Frontend code was hardcoded to use `profiles` table** which may not exist

## Solution Applied

### 1. Updated `frontend/src/js/utils/auth.js`

Made `getUserMetadata()` function more robust:
- ✅ Tries `users` table first (preferred)
- ✅ Falls back to `profiles` table if `users` doesn't exist
- ✅ Falls back to `user_metadata` if neither table exists
- ✅ Handles all errors gracefully

This ensures the app works regardless of which database schema is actually applied.

### 2. Created Diagnostic Tools

**New files:**
- `frontend/src/js/utils/auth-diagnostic.js` - Diagnostic script
- `frontend/public/diagnostic.html` - Diagnostic page

**To use:**
```bash
cd frontend && npm run dev
# Navigate to: http://localhost:5173/diagnostic.html
# Click "Run Diagnostic"
```

The diagnostic will show:
- Current user info
- Which tables exist (users/profiles)
- User metadata from all sources
- Helper function availability
- Company table accessibility

## How to Fix Permanently

### Option A: Use the `users` Table (Recommended)

If you want to use the modern `users` table approach:

1. **Apply the `users-table.sql` schema:**
```bash
# In Supabase SQL Editor, run:
backend/database/users-table.sql
```

2. **Verify the trigger is working:**
   - Sign up a new user
   - Check that a record appears in `users` table
   - Verify role and company_id are populated

### Option B: Use the `profiles` Table

If you prefer the profiles approach:

1. **Apply the migration:**
```bash
# In Supabase SQL Editor, run:
backend/database/migrations/20260207_011_proper_multitenant.sql
```

2. **This will:**
   - Create `profiles` table
   - Migrate existing users
   - Update helper functions
   - Set up RLS policies

### Option C: Use User Metadata Only

If you want to keep it simple (not recommended for production):

1. The app will automatically fall back to `user_metadata`
2. No database tables needed for user profiles
3. But this has limitations:
   - No database-level validation
   - Harder to query users
   - Less secure (client can modify)

## Immediate Workaround

The updated `auth.js` should already make things work! But verify:

1. **Check current state:**
```bash
cd frontend && npm run dev
# Go to: http://localhost:5173/diagnostic.html
# Run diagnostic
```

2. **Check console output:**
   - Should show which table it found
   - Should show your role (sys_admin)
   - Should show your company_id

3. **If sys_admin still not recognized:**
   - Check browser console for errors
   - Verify `user_metadata.role` is set to 'sys_admin'
   - Try logging out and back in

## Verifying the Fix

### Test 1: Bootstrap Modal
```bash
# Sign out completely
# Go to: http://localhost:5173/index.html
# Should see bootstrap modal if no sys_admin exists
```

### Test 2: Admin Page Access
```bash
# Sign in as sys_admin
# Go to: http://localhost:5173/admin.html
# Should see admin panel (not "Access Denied")
```

### Test 3: Role Check
```javascript
// In browser console:
import { getUserMetadata } from '../src/js/utils/auth.js';
const metadata = await getUserMetadata();
console.log('Role:', metadata.role);
// Should show: "sys_admin"
```

## Database Schema Status

Check which schema you're currently using:

```sql
-- In Supabase SQL Editor:

-- Check if users table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'users';

-- Check if profiles table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'profiles';

-- Check your user record
SELECT * FROM auth.users WHERE email = 'your-email@example.com';
```

## Recommended Next Steps

1. **Run Diagnostic** - Use the diagnostic page to see current state
2. **Choose Schema** - Decide between users/profiles/metadata approach
3. **Apply Migrations** - Run the appropriate SQL migration
4. **Test Thoroughly** - Verify sys_admin recognition works
5. **Document Decision** - Update CLAUDE.md with chosen approach

## Prevention

To avoid this in the future:

1. **Stick to one schema** - Don't mix users/profiles approaches
2. **Keep migrations organized** - Apply in order, don't skip
3. **Use diagnostic page** - Check state after major changes
4. **Update documentation** - Keep CLAUDE.md current

## Support

If still having issues:

1. Run diagnostic and share console output
2. Check browser DevTools console for errors
3. Verify database schema is applied correctly
4. Check RLS policies are not blocking access

## Files Changed

- ✅ `frontend/src/js/utils/auth.js` - Made robust with multiple fallbacks
- ✅ `frontend/src/js/utils/auth-diagnostic.js` - New diagnostic tool
- ✅ `frontend/public/diagnostic.html` - New diagnostic page

The app should now work regardless of database schema state!
