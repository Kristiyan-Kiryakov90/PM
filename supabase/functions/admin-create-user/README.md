# Edge Function: admin-create-user

## Purpose

Allows company admins to create new users with proper security using service role privileges.

## Security Features

✅ **Service Role Key** - Uses `SUPABASE_SERVICE_ROLE_KEY` (never exposed to client)
✅ **Permission Validation** - Calls `validate_admin_can_create_user()` database function
✅ **Atomic Operations** - Creates `auth.users` + `profiles` in transaction
✅ **Temporary Passwords** - Generates secure temp passwords
✅ **Company Isolation** - User inherits admin's company_id

## Deployment

### Deploy to Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref zuupemhuaovzqqhyyocz

# Deploy function
supabase functions deploy admin-create-user

# Set environment secrets (if not already set)
supabase secrets set SUPABASE_URL=https://zuupemhuaovzqqhyyocz.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Get Service Role Key

1. Go to Supabase Dashboard → Settings → API
2. Copy **service_role** key (starts with `eyJ...`)
3. ⚠️ **NEVER commit this key or expose it to clients!**

## Usage

### From Frontend (Admin Panel)

```typescript
// frontend/src/js/pages/admin.js

async function createTeamMember(email: string, firstName: string, lastName: string, role: 'admin' | 'user') {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role
    }
  })

  if (error) {
    console.error('Failed to create user:', error)
    alert('Error: ' + error.message)
    return
  }

  // Show success with temporary password
  alert(`User created!\n\nEmail: ${data.user.email}\nTemp Password: ${data.user.temp_password}\n\nShare this securely with the user.`)

  // TODO: In production, send email instead of showing password
}
```

### Request Format

```json
POST https://zuupemhuaovzqqhyyocz.supabase.co/functions/v1/admin-create-user

Headers:
  Authorization: Bearer <user-jwt-token>
  Content-Type: application/json

Body:
{
  "email": "newuser@company.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}
```

### Response Format

**Success (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "newuser@company.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user",
    "company_id": "uuid",
    "temp_password": "TempXXXXXXXX!"
  },
  "message": "User created successfully. Share the temporary password securely."
}
```

**Error (400):**
```json
{
  "error": "Permission denied: Only company admins can create users",
  "details": "..."
}
```

## Testing

### Test Locally

```bash
# Start Supabase locally (if using local dev)
supabase start

# Serve function locally
supabase functions serve admin-create-user --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/admin-create-user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "user"
  }'
```

### Test in Production

```bash
# Get your JWT token (from browser devtools after logging in)
# Then test:

curl -X POST https://zuupemhuaovzqqhyyocz.supabase.co/functions/v1/admin-create-user \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "real@example.com",
    "firstName": "Real",
    "lastName": "User",
    "role": "user"
  }'
```

## Security Checks

The function validates:

1. ✅ Requesting user is authenticated (valid JWT)
2. ✅ Requesting user has `admin` role in their company
3. ✅ Target email doesn't already exist
4. ✅ Target role is valid (`admin` or `user`)
5. ✅ New user is added to requesting admin's company (can't add to other companies)

## Database Function

The function calls `validate_admin_can_create_user()` which:

```sql
-- Check if requesting user is admin
SELECT role FROM profiles WHERE id = auth.uid() AND role = 'admin'

-- Get company_id from requesting user's profile
SELECT company_id FROM profiles WHERE id = auth.uid()

-- Validate target email doesn't exist
SELECT 1 FROM auth.users WHERE email = target_email

-- Return approved company_id and role
RETURN json_build_object('company_id', ..., 'approved_role', ...)
```

## Email Integration (TODO)

In production, replace temp password return with email:

```typescript
// Use Resend, SendGrid, or similar
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'noreply@yourapp.com',
    to: email,
    subject: 'Welcome to TaskFlow',
    html: `
      <h1>Welcome to TaskFlow!</h1>
      <p>Your account has been created by your company admin.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please log in and reset your password immediately.</p>
      <a href="https://yourapp.com/signin">Log In</a>
    `
  })
})
```

## Logs

View function logs in Supabase Dashboard:
- Go to Edge Functions → admin-create-user → Logs
- Or use CLI: `supabase functions logs admin-create-user`

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Missing Authorization header" | No JWT token | Pass token from authenticated user |
| "Permission denied" | User is not admin | Only admins can create users |
| "Email already exists" | Duplicate email | Use different email |
| "Invalid role" | Role not 'admin' or 'user' | Fix role value |
| "Failed to create profile" | Database error | Check migration applied correctly |

## Related Files

- `backend/database/migrations/20260207_009_admin_create_users.sql` - Database functions
- `backend/database/migrations/20260207_011_proper_multitenant.sql` - profiles table
- `frontend/src/js/pages/admin.js` - Frontend integration
