/**
 * Auth Diagnostic Script
 * Run this to check database state and auth configuration
 */

import supabase from '@services/supabase.js';

export async function runAuthDiagnostic() {
  console.log('=== AUTH DIAGNOSTIC START ===\n');

  try {
    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('❌ Error getting user:', userError);
      return;
    }

    if (!user) {
      console.log('❌ No user logged in');
      return;
    }

    console.log('✅ Current User:');
    console.log('  Email:', user.email);
    console.log('  ID:', user.id);
    console.log('  Metadata Role:', user.user_metadata?.role);
    console.log('  Metadata Company ID:', user.user_metadata?.company_id);
    console.log('');

    // Check if profiles table exists
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profilesError && profiles) {
      console.log('✅ Profiles table exists');
      console.log('  Profile:', profiles);
      console.log('');
    } else {
      console.log('❌ Profiles table not found or no record');
      console.log('  Error:', profilesError?.message);
      console.log('');
    }

    // Check if users table exists
    const { data: userRecord, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!usersError && userRecord) {
      console.log('✅ Users table exists');
      console.log('  User record:', userRecord);
      console.log('');
    } else {
      console.log('❌ Users table not found or no record');
      console.log('  Error:', usersError?.message);
      console.log('');
    }

    // Check helper functions
    try {
      const { data: companyId, error: funcError1 } = await supabase.rpc('user_company_id');
      console.log('✅ user_company_id() function:', companyId);
    } catch (e) {
      console.log('❌ user_company_id() function not available:', e.message);
    }

    try {
      const { data: isSysAdmin, error: funcError2 } = await supabase.rpc('is_system_admin');
      console.log('✅ is_system_admin() function:', isSysAdmin);
    } catch (e) {
      console.log('❌ is_system_admin() function not available:', e.message);
    }

    try {
      const { data: isAdmin, error: funcError3 } = await supabase.rpc('is_company_admin');
      console.log('✅ is_company_admin() function:', isAdmin);
    } catch (e) {
      console.log('❌ is_company_admin() function not available:', e.message);
    }

    console.log('\n=== AUTH DIAGNOSTIC END ===');
  } catch (error) {
    console.error('Diagnostic error:', error);
  }
}

// Auto-run in browser console
if (typeof window !== 'undefined') {
  window.runAuthDiagnostic = runAuthDiagnostic;
  console.log('Auth diagnostic loaded. Run window.runAuthDiagnostic() to check auth state.');
}
