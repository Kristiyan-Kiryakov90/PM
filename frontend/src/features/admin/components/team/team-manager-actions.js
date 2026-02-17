/**
 * Team Manager - CRUD Actions
 * Handles create, update, delete, and password reset operations
 */

import supabase from '@services/supabase.js';

/**
 * Create a new team member
 * @param {Object} params - Member data
 */
export async function createMember({ email, full_name, password, role, company_name }) {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error('Not authenticated');

    // Check if current user has a company
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', currentUser.id)
      .single();

    let companyId = currentProfile?.company_id;

    // If admin doesn't have a company yet and provided a company name, create one
    if (!companyId && company_name && currentProfile?.role === 'admin') {
      const { data: newCompanyId, error: companyError } = await supabase
        .rpc('create_company_for_admin', { company_name });

      if (companyError) throw companyError;

      companyId = newCompanyId;
      console.log('Created company and assigned to current user, id:', companyId);
    }

    // Sign up the new user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role
        }
      }
    });

    if (error) throw error;

    // Assign company to new user if we have one
    if (companyId && data.user) {
      const { error: assignError } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', data.user.id);

      if (assignError) throw assignError;
    }

    console.log('User created:', data);
  } catch (error) {
    console.error('Error creating member:', error);
    throw error;
  }
}

/**
 * Update team member
 * @param {string} memberId - Member ID
 * @param {Object} data - Update data
 */
export async function updateMember(memberId, { full_name, role }) {
  console.log('Updating member:', memberId, 'with role:', role);

  try {
    // Update role in profiles table
    const { data, error: profileError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', memberId)
      .select();

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw profileError;
    }

    console.log('Profile updated successfully:', data);

    // Note: We can't update user_metadata (full_name) from client side
    // This would need to be handled by a backend API or Edge Function
    console.log('Note: Full name updates require backend API support');
  } catch (error) {
    console.error('Error in updateMember:', error);
    throw error;
  }
}

/**
 * Delete team member (from both auth.users and profiles)
 * @param {string} memberId - Member ID
 */
export async function deleteMember(memberId) {
  console.log('Deleting member:', memberId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const response = await fetch(
      `${supabase.supabaseUrl}/functions/v1/admin-delete-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: memberId,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete user');
    }

    console.log('User deleted successfully from both auth and profiles tables');
  } catch (error) {
    console.error('Error in deleteMember:', error);
    throw error;
  }
}

/**
 * Reset user password (sys_admin only)
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 */
export async function resetUserPassword(userId, newPassword) {
  console.log('Resetting password for user:', userId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const response = await fetch(
      `${supabase.supabaseUrl}/functions/v1/admin-reset-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newPassword,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to reset password');
    }

    console.log('Password reset successfully');
  } catch (error) {
    console.error('Error in resetUserPassword:', error);
    throw error;
  }
}

/**
 * Send password reset email to user
 * @param {string} email - User email
 */
export async function sendPasswordResetEmail(email) {
  console.log('Sending password reset email to:', email);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });

    if (error) throw error;

    console.log('Password reset email sent successfully');
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
    throw error;
  }
}
