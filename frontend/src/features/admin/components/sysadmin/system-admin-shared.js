/**
 * System Admin - Shared Utilities
 * Shared functions and API calls used by both user and company modules
 */

import supabase from '@services/supabase.js';

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Get all users with companies (sys_admin only)
 */
export async function getAllUsersWithCompanies() {
  const { data, error } = await supabase.rpc('get_all_users_with_companies');
  if (error) throw error;
  return data || [];
}

/**
 * Get all companies (sys_admin only)
 */
export async function getAllCompanies() {
  const { data, error } = await supabase.rpc('get_all_companies');
  if (error) throw error;
  return data || [];
}

/**
 * Check if current user is sys_admin
 * @returns {Promise<{isSysAdmin: boolean, currentUserId: string}>}
 */
export async function checkSysAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isSysAdmin: false, currentUserId: null };

  const currentUserId = user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isSysAdmin = profile?.role === 'sys_admin';

  return { isSysAdmin, currentUserId };
}
