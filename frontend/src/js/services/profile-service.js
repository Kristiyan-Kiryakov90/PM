/**
 * Profile Service
 * Handles user profile operations (name updates, password changes)
 */

import supabase from './supabase.js';
import { getUserMetadata } from '@utils/auth.js';

/**
 * Update user profile (first name, last name)
 * @param {Object} profileData - { first_name, last_name }
 * @returns {Promise<Object>} Updated user
 */

export const profileService = {
  async updateProfile(profileData) {
    try {
      const { first_name, last_name } = profileData;

      // Validation
      if (!first_name || !first_name.trim()) {
        throw new Error('First name is required');
      }

      if (!last_name || !last_name.trim()) {
        throw new Error('Last name is required');
      }

      // Update auth user metadata
      const { data, error } = await supabase.auth.updateUser({
        data: {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
        },
      });

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      // Also update profiles table if user has a profile
      const metadata = await getUserMetadata();
      if (metadata) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            // Note: profiles table doesn't have first_name/last_name columns
            // These are stored in auth.users metadata only
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.user.id);

        if (profileError) {
          console.warn('Profile table update warning:', profileError);
        }
      }

      return data.user;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Updated user
   */,
  async changePassword(newPassword) {
    try {
      // Validation
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // Check password complexity
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);

      if (!hasUpperCase || !hasLowerCase || !hasNumber) {
        throw new Error('Password must contain uppercase, lowercase, and number');
      }

      // Update password
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Password change error:', error);
        throw error;
      }

      return data.user;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   * @returns {Promise<Object>} User profile
   */,
  async getProfile() {
    try {
      const metadata = await getUserMetadata();
      if (!metadata) {
        throw new Error('User not authenticated');
      }

      return metadata;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

};
