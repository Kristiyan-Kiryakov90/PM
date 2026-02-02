/**
 * Authentication Utilities
 * Helper functions for managing user authentication and session
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
 * Get user profile from public.users table
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
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
  const profile = await getUserProfile();
  return profile?.role === role;
}

/**
 * Check if user is system admin
 * @returns {Promise<boolean>}
 */
export async function isSysAdmin() {
  return await hasRole('sys_admin');
}

/**
 * Check if user is company admin
 * @returns {Promise<boolean>}
 */
export async function isCompanyAdmin() {
  const profile = await getUserProfile();
  return profile?.role === 'admin' || profile?.role === 'sys_admin';
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
  window.location.href = '/public/index.html';
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
