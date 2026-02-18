/**
 * Authentication Service
 * Business logic for user authentication and registration
 */

import supabase from '@services/supabase.js';

/**
 * Check if any sys_admin exists in the system
 * Uses a SECURITY DEFINER RPC function that queries auth.users
 * @returns {Promise<boolean>}
 */
export const authService = {
  async sysAdminExists() {
    try {
      const { data, error } = await supabase.rpc('check_sys_admin_exists');

      if (error) {
        console.error('Error checking sys_admin:', error);
        // If the RPC fails, fall back to checking current user metadata
        const { data: { user } } = await supabase.auth.getUser();
        return !!(user && user.user_metadata?.role === 'sys_admin');
      }

      return data === true;
    } catch (error) {
      console.error('Error checking sys_admin:', error);
      return false;
    }
  },

  /**
   * Bootstrap: Create first sys_admin and company
   * @param {Object} data - Company and admin data
   * @returns {Promise<Object>} Created user
   */
  async bootstrapSysAdmin(data) {
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
        emailRedirectTo: `${window.location.origin}/index.html`,
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
  },

  /**
   * Standard Registration: Create company and user
   * @param {Object} data - Registration data
   * @returns {Promise<Object>} Created user
   */
  async registerWithCompany(data) {
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
        emailRedirectTo: `${window.location.origin}/index.html`,
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
  },

  /**
   * Sign in user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User session
   */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out user
   * @returns {Promise<void>}
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get redirect URL based on user role
   * @param {string} role - User role
   * @returns {string} Redirect URL
   */
  getRedirectByRole(role) {
    switch (role) {
      case 'sys_admin':
      case 'admin':
        return '/admin.html';
      default:
        return '/dashboard.html';
    }
  }

};

