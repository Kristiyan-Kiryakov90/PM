/**
 * Router Utilities
 * Route guards and navigation helpers
 */

import { authUtils } from '@utils/auth.js';

export const router = {
  /**
   * Require user to be authenticated
   * Redirects to sign in page if not authenticated
   * @returns {Promise<Object>} User session
   */
  async requireAuth() {
    const user = await authUtils.getCurrentUser();

    if (!user) {
      const currentPath = window.location.pathname;
      const returnUrl = encodeURIComponent(currentPath);
      window.location.href = `/public/signin.html?return=${returnUrl}`;
      throw new Error('Not authenticated');
    }

    return user;
  },

  /**
   * Require user to have specific role(s)
   * Redirects if not authenticated or doesn't have required role
   * @param {string|string[]} roles - Required role(s)
   * @returns {Promise<Object>} User metadata
   */
  async requireRole(roles) {
    await this.requireAuth();

    const metadata = await authUtils.getUserMetadata();
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(metadata.role)) {
      alert('Access denied. You do not have permission to view this page.');
      window.location.href = '/public/dashboard.html';
      throw new Error('Insufficient permissions');
    }

    return metadata;
  },

  /**
   * Require user to be admin (admin or sys_admin)
   * @returns {Promise<Object>} User metadata
   */
  async requireAdmin() {
    return await this.requireRole(['admin', 'sys_admin']);
  },

  /**
   * Require user to be sys_admin
   * @returns {Promise<Object>} User metadata
   */
  async requireSysAdmin() {
    return await this.requireRole('sys_admin');
  },

  /**
   * Redirect if user is already authenticated
   * Useful for login/signup pages
   * @returns {Promise<boolean>} True if redirected, false otherwise
   */
  async redirectIfAuthenticated() {
    const user = await authUtils.getCurrentUser();

    if (user) {
      const metadata = await authUtils.getUserMetadata();
      console.log('Redirecting authenticated user. Role:', metadata?.role);

      // Redirect based on role
      if (metadata?.role === 'sys_admin' || metadata?.role === 'admin') {
        console.log('Redirecting to admin.html');
        window.location.href = '/public/admin.html';
      } else {
        console.log('Redirecting to dashboard.html');
        window.location.href = '/public/dashboard.html';
      }

      return true;
    }

    return false;
  },

  /**
   * Navigate to a page
   * @param {string} url - Target URL
   */
  navigate(url) {
    window.location.href = url;
  },

  /**
   * Get return URL from query parameter
   * @returns {string} Return URL or default dashboard
   */
  getReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('return');
    return returnUrl ? decodeURIComponent(returnUrl) : '/public/dashboard.html';
  },

  /**
   * Navigate back to return URL
   */
  navigateToReturnUrl() {
    const url = this.getReturnUrl();
    this.navigate(url);
  },
};

