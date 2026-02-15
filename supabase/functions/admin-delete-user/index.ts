// Admin Delete User Edge Function
// Properly deletes user from auth.users (profile CASCADE deletes automatically)

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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin or sys_admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw new Error('Failed to verify permissions')
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'sys_admin'
    const isSysAdmin = profile?.role === 'sys_admin'

    if (!isAdmin) {
      throw new Error('Only admins can delete users')
    }

    // Get request body
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('userId is required')
    }

    // Prevent deleting yourself
    if (userId === user.id) {
      throw new Error('Cannot delete yourself')
    }

    // Get target user info
    const { data: targetProfile } = await supabaseClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      throw new Error('User not found')
    }

    // Company admins can only delete users from their own company
    if (!isSysAdmin) {
      if (targetProfile.company_id !== profile.company_id) {
        throw new Error('Can only delete users from your own company')
      }
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

    // Delete from auth.users (profile will CASCADE delete automatically)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully (from both auth and profile tables)',
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
