/**
 * Authentication Utilities
 * Helper functions for managing user authentication and session
 * Updated to use auth.users metadata only (no public.users table)
 */

import supabase from '@services/supabase.js';

/**
 * Get current user session
 * @returns {Promise<Object|null>} User session or null
 */
export async function getCurrentUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user || null;
}

/**
 * Get user metadata (role, company_id, name) from database or metadata
 * Tries multiple sources in order: users table, profiles table, then user_metadata
 * @returns {Promise<Object|null>} User metadata or null
 */
export async function getUserMetadata() {
  const user = await getCurrentUser();
  if (!user) return null;

  console.log('Getting metadata for user:', user.email);

  // Get user metadata from profiles table
  try {
    const { data: profile, error: profilesError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profilesError && profile) {
      console.log('✅ Found in profiles table:', profile);
      return {
        id: user.id,
        email: user.email,
        role: profile.role,
        company_id: profile.company_id,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        created_at: user.created_at,
      };
    }
  } catch (e) {
    console.error('Error fetching profile:', e.message);
  }

  // Fallback to user_metadata (for bootstrapping and backward compatibility)
  console.log('⚠️ Using user_metadata fallback');
  const metadata = {
    id: user.id,
    email: user.email,
    role: user.user_metadata?.role || 'user',
    company_id: user.user_metadata?.company_id || null,
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    created_at: user.created_at,
  };
  console.log('Returning metadata:', metadata);
  return metadata;
}

/**
 * Get user's full name from metadata
 * @returns {Promise<string>} Full name or email
 */
export async function getUserFullName() {
  const metadata = await getUserMetadata();
  if (!metadata) return '';

  const fullName = `${metadata.first_name} ${metadata.last_name}`.trim();
  return fullName || metadata.email;
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Check if user has specific role
 * @param {string} role - Role to check (sys_admin, admin, user)
 * @returns {Promise<boolean>}
 */
export async function hasRole(role) {
  const metadata = await getUserMetadata();
  return metadata?.role === role;
}

/**
 * Check if user is system admin
 * @returns {Promise<boolean>}
 */
export async function isSysAdmin() {
  return await hasRole('sys_admin');
}

/**
 * Check if user is company admin (admin or sys_admin)
 * @returns {Promise<boolean>}
 */
export async function isCompanyAdmin() {
  const metadata = await getUserMetadata();
  return metadata?.role === 'admin' || metadata?.role === 'sys_admin';
}

/**
 * Get user's company ID from profiles table
 * @returns {Promise<string|null>} Company ID (UUID) or null
 */
export async function getUserCompanyId() {
  const metadata = await getUserMetadata();
  return metadata?.company_id || null;
}

/**
 * Sign out user
 * @returns {Promise<void>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
  // Clear any cached data
  sessionStorage.clear();
  localStorage.removeItem('supabase.auth.token');

  // Redirect to main landing page
  window.location.href = '/index.html';
}

/**
 * Redirect to login if not authenticated
 * @returns {Promise<void>}
 */
export async function requireAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = '/public/signin.html';
  }
}

/**
 * Redirect to dashboard if already authenticated
 * @returns {Promise<void>}
 */
export async function redirectIfAuthenticated() {
  const authenticated = await isAuthenticated();
  if (authenticated) {
    window.location.href = '/public/dashboard.html';
  }
}

/**
 * Require specific role (redirect if not authorized)
 * @param {string|string[]} roles - Required role(s)
 * @returns {Promise<void>}
 */
export async function requireRole(roles) {
  await requireAuth();

  const metadata = await getUserMetadata();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(metadata.role)) {
    alert('Access denied. You do not have permission to view this page.');
    window.location.href = '/public/dashboard.html';
  }
}

/**
 * Require admin role (admin or sys_admin)
 * @returns {Promise<void>}
 */
export async function requireAdmin() {
  await requireRole(['admin', 'sys_admin']);
}

/**
 * Require sys_admin role
 * @returns {Promise<void>}
 */
export async function requireSysAdmin() {
  await requireRole('sys_admin');
}

/**
 * Listen for auth state changes
 * @param {Function} callback - Callback function to run on auth change
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return data.subscription.unsubscribe;
}

/**
 * Update user metadata (e.g., first_name, last_name)
 * Note: Role and company_id should only be changed by admins via Admin API
 * @param {Object} metadata - Metadata to update
 * @returns {Promise<Object>} Updated user
 */
export async function updateUserMetadata(metadata) {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) {
    console.error('Update user metadata error:', error);
    throw error;
  }

  return data.user;
}
