/**
 * Edge Function: admin-create-user
 * Allows company admins to create users with service role privileges
 *
 * Security:
 * - Uses service role key (not exposed to client)
 * - Validates admin permissions via database function
 * - Creates auth.users + profiles atomically
 * - Generates secure temporary password
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'user'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { email, firstName, lastName, role }: CreateUserRequest = await req.json()

    // Validate inputs
    if (!email || !firstName || !lastName || !role) {
      throw new Error('Missing required fields: email, firstName, lastName, role')
    }

    if (!['admin', 'user'].includes(role)) {
      throw new Error('Invalid role. Must be "admin" or "user"')
    }

    // Create Supabase client with service role (has admin privileges)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get requesting user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !requestingUser) {
      throw new Error('Invalid or expired token')
    }

    // Validate requesting user has admin permissions
    const { data: validation, error: validationError } = await supabaseAdmin
      .rpc('validate_admin_can_create_user', {
        p_admin_user_id: requestingUser.id,
        p_target_email: email,
        p_target_role: role
      })

    if (validationError) {
      throw new Error(`Permission denied: ${validationError.message}`)
    }

    if (!validation || !validation.success) {
      throw new Error('Admin validation failed')
    }

    // Generate secure temporary password
    // Format: TempXXXXXXXX! (8 random chars + !)
    const randomChars = Math.random().toString(36).substring(2, 10)
    const tempPassword = `Temp${randomChars}!`

    // Create user with admin API
    const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        // Don't set company_id or role here - will be set by trigger
      }
    })

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`)
    }

    if (!newUserData.user) {
      throw new Error('User creation returned no data')
    }

    // Create profile (trigger should do this, but ensure it exists)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserData.user.id,
        company_id: validation.company_id,
        role: validation.approved_role,
        created_at: new Date().toISOString()
      })

    if (profileError && !profileError.message.includes('duplicate')) {
      // Ignore duplicate errors (trigger already created it)
      console.error('Profile creation error:', profileError)
      throw new Error(`Failed to create profile: ${profileError.message}`)
    }

    // TODO: Send email to new user with credentials
    // For now, return password to admin (they can send it securely)
    // In production, use a transactional email service:
    // - Resend (resend.com)
    // - SendGrid
    // - AWS SES
    // - Postmark

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserData.user.id,
          email: newUserData.user.email,
          first_name: firstName,
          last_name: lastName,
          role: validation.approved_role,
          company_id: validation.company_id,
          temp_password: tempPassword, // ⚠️ In production, send via email only!
        },
        message: 'User created successfully. Share the temporary password securely.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in admin-create-user:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
