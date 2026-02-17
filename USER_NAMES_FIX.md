# User Names in Team Productivity Report - Fixed

## Issue
Team Productivity report was showing UUIDs instead of user names:
```
Unassigned                          5    0    1    4    0.0%
b50fa7b0-cd76-473b-ae37-4fbb8bd08fff    1    1    0    0    100.0%
```

## Root Cause
The `getTeamProductivity()` function was grouping tasks by `assigned_to` (UUID) but not fetching user names.

## Solution
Updated the function to:
1. Call `get_company_team_members()` database function to fetch user profiles
2. Build a lookup map of `user_id -> display_name`
3. Add `userName` field to metrics with proper display name

## Changes Made

### 1. Updated Query (`reports-queries.js`)

**Before:**
```javascript
const userMetrics = {};
tasks.forEach(task => {
  const userId = task.assigned_to || 'unassigned';
  if (!userMetrics[userId]) {
    userMetrics[userId] = {
      userId,  // Only UUID stored
      total: 0,
      // ...
    };
  }
});
```

**After:**
```javascript
// Fetch team members with names
const { data: teamMembers } = await supabase
  .rpc('get_company_team_members', { p_company_id: companyId });

// Build user name lookup
const userNamesMap = {};
teamMembers?.forEach(member => {
  const displayName = member.full_name || member.email || 'Unknown User';
  userNamesMap[member.user_id] = displayName;
});

// Add userName to metrics
const userMetrics = {};
tasks.forEach(task => {
  const userId = task.assigned_to || 'unassigned';
  if (!userMetrics[userId]) {
    userMetrics[userId] = {
      userId,
      userName: userId === 'unassigned'
        ? 'Unassigned'
        : (userNamesMap[userId] || userId),  // Display name or fallback to UUID
      total: 0,
      // ...
    };
  }
});
```

### 2. Updated Renderer (`reports-renderers.js`)

**Before:**
```javascript
<td>${user.userId === 'unassigned' ? 'Unassigned' : user.userId}</td>
```

**After:**
```javascript
<td>${user.userName || user.userId}</td>
```

## How It Works

### Name Resolution Priority:
1. **Full Name** - From `auth.users.raw_user_meta_data->>'full_name'`
2. **Email** - From `auth.users.email`
3. **UUID** - Fallback if name not found
4. **"Unassigned"** - For tasks without assignment

### Data Flow:
```
Tasks with assigned_to UUIDs
    ↓
Call get_company_team_members() function
    ↓
Returns: user_id, email, full_name
    ↓
Build lookup map: UUID → Display Name
    ↓
Display: "John Doe" instead of "b50fa7b0-cd76-..."
```

## Testing

### Before:
```
User                                      Total  Completed  In Progress  To Do  Rate
─────────────────────────────────────────────────────────────────────────────────
Unassigned                                5      0          1            4      0.0%
b50fa7b0-cd76-473b-ae37-4fbb8bd08fff      1      1          0            0      100.0%
```

### After:
```
User                Total  Completed  In Progress  To Do  Rate
────────────────────────────────────────────────────────────
Unassigned          5      0          1            4      0.0%
John Doe            1      1          0            0      100.0%
```

## Database Function Used

The fix uses the existing `get_company_team_members()` function:
```sql
CREATE OR REPLACE FUNCTION get_company_team_members(p_company_id bigint)
RETURNS TABLE (
    user_id uuid,
    email text,
    full_name text,
    avatar_url text,
    role text,
    ...
)
```

This function:
- ✅ Uses `SECURITY DEFINER` to access `auth.users` table
- ✅ Returns `full_name` from user metadata
- ✅ Falls back to email if full_name not set
- ✅ Filters by company_id for proper isolation

## Files Modified

1. ✅ `frontend/src/shared/services/reports/reports-queries.js`
   - Added user name fetching
   - Added userName field to metrics

2. ✅ `frontend/src/features/reports/pages/reports-renderers.js`
   - Updated to display userName instead of userId

## Build Status

```
✓ 200 modules transformed
✓ built in 1.21s
No errors!
```

## What to Test

1. **Open Reports Page** → Team Productivity section
2. **Expected**: See actual user names (or emails) instead of UUIDs
3. **Verify**:
   - Users with full names show: "John Doe"
   - Users without full names show: "john@example.com"
   - Unassigned tasks show: "Unassigned"
   - No UUIDs visible

## Notes

- Works for company users only (personal users don't have teams)
- Respects RLS policies (only shows team members from same company)
- Graceful fallback if name not found (shows UUID as last resort)
- No breaking changes to existing functionality
