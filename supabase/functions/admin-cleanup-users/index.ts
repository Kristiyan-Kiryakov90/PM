// Admin Cleanup Users Edge Function
// Deletes all auth.users except the sys_admin

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is sys_admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is sys_admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'sys_admin') {
      throw new Error('Only sys_admin can cleanup users')
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get all auth users
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      throw listError
    }

    // Delete all users except the current sys_admin
    const deletedUsers = []
    const errors = []

    for (const authUser of users) {
      if (authUser.id !== user.id) {
        try {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
          if (deleteError) {
            errors.push({ userId: authUser.id, email: authUser.email, error: deleteError.message })
          } else {
            deletedUsers.push({ userId: authUser.id, email: authUser.email })
          }
        } catch (err) {
          errors.push({ userId: authUser.id, email: authUser.email, error: err.message })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${deletedUsers.length} test users`,
        deletedUsers,
        errors: errors.length > 0 ? errors : undefined,
        keptUser: {
          userId: user.id,
          email: user.email,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
