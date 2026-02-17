/**
 * Team Manager - Data Loading & Filtering
 * Handles fetching users, companies, and filtering logic
 */

import supabase from '@services/supabase.js';
import { teamService } from '@services/team-service.js';

/**
 * Get all users with companies (sys_admin only)
 */
export async function getAllUsersWithCompanies() {
  try {
    const { data, error } = await supabase.rpc('get_all_users_with_companies');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

/**
 * Get all companies (sys_admin only)
 */
export async function getAllCompanies() {
  try {
    const { data, error } = await supabase.rpc('get_all_companies');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting companies:', error);
    throw error;
  }
}

/**
 * Get all team members (regular admin)
 */
export async function getTeamMembers() {
  try {
    // Get current user's company info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    let companyName = null;
    const companyId = profile?.company_id;

    // Get company name if user has a company
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      companyName = company?.name;
    }

    const members = await teamService.getTeamMembers();

    // Transform to expected format and filter out sys_admin users
    return members
      .filter(member => member.role !== 'sys_admin') // Regular admins shouldn't see sys_admins
      .map(member => ({
        id: member.id,
        email: member.email,
        full_name: member.full_name || member.email,
        role: member.role,
        status: member.status,
        company_id: companyId,
        company_name: companyName
      }));
  } catch (error) {
    console.error('Error getting team members:', error);
    throw error;
  }
}

/**
 * Apply company filter to team members
 * @param {Array} allMembers - All members
 * @param {string} filterValue - Filter value ('all', 'personal', or company ID)
 * @returns {Array} Filtered members
 */
export function applyCompanyFilter(allMembers, filterValue) {
  if (filterValue === 'all') {
    return allMembers;
  }

  if (filterValue === 'personal') {
    return allMembers.filter(m => !m.company_id);
  }

  return allMembers.filter(m => m.company_id === parseInt(filterValue));
}

/**
 * Check if current user is sys_admin and get company info
 * @returns {Object} { isSysAdmin, currentUserId, currentUserCompany }
 */
export async function checkUserPermissions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isSysAdmin: false, currentUserId: null, currentUserCompany: null };

  const currentUserId = user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  const isSysAdmin = profile?.role === 'sys_admin';

  let currentUserCompany = null;

  // Store current user's company info for regular admins
  if (!isSysAdmin && profile?.company_id) {
    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', profile.company_id)
      .single();

    currentUserCompany = {
      id: profile.company_id,
      name: company?.name || 'Your Company'
    };

    console.log('Current user company:', currentUserCompany);
  }

  return { isSysAdmin, currentUserId, currentUserCompany };
}
