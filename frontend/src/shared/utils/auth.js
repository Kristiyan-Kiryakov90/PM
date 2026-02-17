/**
 * Authentication Utilities
 * Helper functions for managing user authentication and session
 * Updated to use auth.users metadata only (no public.users table)
 */

import supabase from '@services/supabase.js';

// Cache for user metadata (in-memory, cleared on page reload)
let metadataCache = null;
let currentUserCache = null;

// sessionStorage key and TTL for cross-page metadata caching.
// TTL is kept short (3 min) to limit exposure window; RLS enforces real access control.
const METADATA_SESSION_KEY = 'tf_user_metadata_v1';
const METADATA_SESSION_TTL = 3 * 60 * 1000; // 3 minutes

export const authUtils = {
  /**
   * Get current user session (cached after first call)
   * @returns {Promise<Object|null>} User session or null
   */
  async getCurrentUser() {
    // Return cached user if available
    if (currentUserCache) {
      return currentUserCache;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    currentUserCache = session?.user || null;
    return currentUserCache;
  },

  /**
   * Get user metadata (role, company_id, name) from database or metadata
   * Cached after first call to avoid N+1 queries
   * @returns {Promise<Object|null>} User metadata or null
   */
  async getUserMetadata() {
    // 1. Return in-memory cache if available (fastest, same-page calls)
    if (metadataCache) {
      return metadataCache;
    }

    // 2. Check sessionStorage cache (survives page navigation within same session)
    try {
      const cached = sessionStorage.getItem(METADATA_SESSION_KEY);
      if (cached) {
        const { data, timestamp, userId } = JSON.parse(cached);
        const user = await this.getCurrentUser();
        if (user && data && userId === user.id && (Date.now() - timestamp) < METADATA_SESSION_TTL) {
          metadataCache = data;
          return metadataCache;
        }
      }
    } catch (e) { /* ignore parse errors */ }

    const user = await this.getCurrentUser();
    if (!user) return null;

    // 3. Fetch from database
    try {
      const { data: profile, error: profilesError } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profilesError && profile) {
        metadataCache = {
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

    // Fallback to user_metadata if profile fetch failed
    if (!metadataCache) {
      metadataCache = {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'user',
        company_id: user.user_metadata?.company_id || null,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        created_at: user.created_at,
      };
    }

    // 4. Store in sessionStorage for next page navigation
    try {
      sessionStorage.setItem(METADATA_SESSION_KEY, JSON.stringify({
        data: metadataCache,
        timestamp: Date.now(),
        userId: user.id,
      }));
    } catch (e) { /* ignore quota errors */ }

    return metadataCache;
  },

  /**
   * Get user's full name from metadata
   * @returns {Promise<string>} Full name or email
   */
  async getUserFullName() {
    const metadata = await this.getUserMetadata();
    if (!metadata) return '';

    const fullName = `${metadata.first_name} ${metadata.last_name}`.trim();
    return fullName || metadata.email;
  },

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return !!user;
  },

  /**
   * Check if user has specific role
   * @param {string} role - Role to check (sys_admin, admin, user)
   * @returns {Promise<boolean>}
   */
  async hasRole(role) {
    const metadata = await this.getUserMetadata();
    return metadata?.role === role;
  },

  /**
   * Check if user is system admin
   * @returns {Promise<boolean>}
   */
  async isSysAdmin() {
    return await this.hasRole('sys_admin');
  },

  /**
   * Check if user is company admin (admin or sys_admin)
   * @returns {Promise<boolean>}
   */
  async isCompanyAdmin() {
    const metadata = await this.getUserMetadata();
    return metadata?.role === 'admin' || metadata?.role === 'sys_admin';
  },

  /**
   * Get user's company ID from profiles table
   * @returns {Promise<string|null>} Company ID (UUID) or null
   */
  async getUserCompanyId() {
    const metadata = await this.getUserMetadata();
    return metadata?.company_id || null;
  },

  /**
   * Clear cached metadata and user (called on logout or when data changes)
   * @returns {void}
   */
  clearCache() {
    metadataCache = null;
    currentUserCache = null;
    try { sessionStorage.removeItem(METADATA_SESSION_KEY); } catch (e) {}
  },

  /**
   * Sign out user
   * @returns {Promise<void>}
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      throw error;
    }
    // Clear any cached data
    this.clearCache();
    sessionStorage.clear();
    localStorage.removeItem('supabase.auth.token');

    // Redirect to main landing page
    window.location.href = '/index.html';
  },

  /**
   * Redirect to login if not authenticated
   * @returns {Promise<void>}
   */
  async requireAuth() {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      window.location.href = '/public/signin.html';
    }
  },

  /**
   * Redirect to dashboard if already authenticated
   * @returns {Promise<void>}
   */
  async redirectIfAuthenticated() {
    const authenticated = await this.isAuthenticated();
    if (authenticated) {
      window.location.href = '/public/dashboard.html';
    }
  },

  /**
   * Require specific role (redirect if not authorized)
   * @param {string|string[]} roles - Required role(s)
   * @returns {Promise<void>}
   */
  async requireRole(roles) {
    await this.requireAuth();

    const metadata = await this.getUserMetadata();
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(metadata.role)) {
      alert('Access denied. You do not have permission to view this page.');
      window.location.href = '/public/dashboard.html';
    }
  },

  /**
   * Require admin role (admin or sys_admin)
   * @returns {Promise<void>}
   */
  async requireAdmin() {
    await this.requireRole(['admin', 'sys_admin']);
  },

  /**
   * Require sys_admin role
   * @returns {Promise<void>}
   */
  async requireSysAdmin() {
    await this.requireRole('sys_admin');
  },

  /**
   * Listen for auth state changes
   * @param {Function} callback - Callback function to run on auth change
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return data.subscription.unsubscribe;
  },

  /**
   * Update user metadata (e.g., first_name, last_name)
   * Note: Role and company_id should only be changed by admins via Admin API
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} Updated user
   */
  async updateUserMetadata(metadata) {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      console.error('Update user metadata error:', error);
      throw error;
    }

    return data.user;
  },
};

