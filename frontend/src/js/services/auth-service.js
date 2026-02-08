/**
 * Authentication Service
 * Business logic for user authentication and registration
 */

import supabase from '@services/supabase.js';

/**
 * Check if current user is sys_admin or if any sys_admin exists in the system
 * @returns {Promise<boolean>}
 */
export async function sysAdminExists() {
  try {
    // First, check if current user is already authenticated and is sys_admin
    const { data: { user } } = await supabase.auth.getUser();

    if (user && user.user_metadata?.role === 'sys_admin') {
      return true; // Current user is sys_admin
    }

    // If not authenticated, try to check if ANY sys_admin exists by attempting an RPC call
    // that only sys_admin can call
    // For now, assume if we got here and user is not sys_admin, we need to bootstrap
    return false;
  } catch (error) {
    console.error('Error checking sys_admin:', error);
    return false; // If error, show bootstrap (safer than hiding it)
  }
}

/**
 * Bootstrap: Create first sys_admin and company
 * @param {Object} data - Company and admin data
 * @returns {Promise<Object>} Created user
 */
export async function bootstrapSysAdmin(data) {
  const { companyName, email, password, firstName, lastName } = data;

  // 1. Create company via RPC (bypasses RLS with SECURITY DEFINER)
  const { data: companyData, error: companyError } = await supabase
    .rpc('signup_with_optional_company', {
      p_company_name: companyName,
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
    });

  if (companyError) throw companyError;

  // 2. Sign up user with sys_admin role
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/public/index.html`,
      data: {
        role: 'sys_admin',
        company_id: companyData.company_id,
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (authError) {
    // Rollback: delete company
    await supabase.rpc('rollback_company_creation', {
      p_company_id: companyData.company_id,
    });
    throw authError;
  }

  // For local development: auto-login after signup (skip email verification)
  // In production, user would need to confirm email first
  if (authData.user) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      console.warn('Auto-login after signup failed:', loginError);
      // User can manually sign in if auto-login fails
    }
  }

  return authData.user;
}

/**
 * Standard Registration: Create company and user
 * @param {Object} data - Registration data
 * @returns {Promise<Object>} Created user
 */
export async function registerWithCompany(data) {
  const { companyName, email, password, firstName, lastName } = data;

  // 1. Create company via RPC (bypasses RLS with SECURITY DEFINER)
  const { data: companyData, error: companyError } = await supabase
    .rpc('signup_with_optional_company', {
      p_company_name: companyName,
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
    });

  if (companyError) throw companyError;

  // 2. Sign up user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/public/index.html`,
      data: {
        role: companyData.role,
        company_id: companyData.company_id,
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (authError) {
    // Rollback: delete company
    await supabase.rpc('rollback_company_creation', {
      p_company_id: companyData.company_id,
    });
    throw authError;
  }

  // For local development: auto-login after signup (skip email verification)
  if (authData.user) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      console.warn('Auto-login after signup failed:', loginError);
    }
  }

  return authData.user;
}

/**
 * Sign in user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} User session
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out user
 * @returns {Promise<void>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get redirect URL based on user role
 * @param {string} role - User role
 * @returns {string} Redirect URL
 */
export function getRedirectByRole(role) {
  switch (role) {
    case 'sys_admin':
    case 'admin':
      return '/public/admin.html';
    default:
      return '/public/dashboard.html';
  }
}
