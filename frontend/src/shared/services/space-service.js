/**
 * Space Service
 * Handles all space CRUD operations with company isolation
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get all spaces for the user (company or personal), sorted by sort_order
 * @returns {Promise<Array>} Array of spaces
 */

export const spaceService = {
  async getSpaces() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('spaces')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      // Company vs personal filter (CRITICAL PATTERN)
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Get a single space by ID
   * @param {number} spaceId - Space ID
   * @returns {Promise<Object>} Space details
   */,
  async getSpace(spaceId) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('spaces')
        .select('*')
        .eq('id', spaceId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      if (!data) {
        throw new Error('Space not found or you do not have permission to access it');
      }

      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Create a new space
   * @param {Object} spaceData - { name, description, color, icon, sort_order }
   * @returns {Promise<Object>} Created space
   */,
  async createSpace(spaceData) {
    try {
      const { name, description = '', color = '#3b82f6', icon = '📁', sort_order = 0 } = spaceData;

      // Validation
      if (!name || name.trim() === '') {
        throw new Error('Space name is required');
      }
      if (name.length > 100) {
        throw new Error('Space name must be 100 characters or less');
      }
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Color must be a valid hex code (e.g., #3b82f6)');
      }

      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('spaces')
        .insert({
          company_id: companyId || null,
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          sort_order,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Update a space
   * @param {number} spaceId - Space ID
   * @param {Object} updates - { name, description, color, icon, sort_order }
   * @returns {Promise<Object>} Updated space
   */,
  async updateSpace(spaceId, updates) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Validate the space belongs to user
      const existing = await this.getSpace(spaceId);
      if (!existing) {
        throw new Error('Space not found');
      }

      // Build update object
      const updateData = {};

      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim() === '') {
          throw new Error('Space name cannot be empty');
        }
        if (updates.name.length > 100) {
          throw new Error('Space name must be 100 characters or less');
        }
        updateData.name = updates.name.trim();
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description.trim() || null;
      }

      if (updates.color !== undefined) {
        if (updates.color && !/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
          throw new Error('Color must be a valid hex code');
        }
        updateData.color = updates.color;
      }

      if (updates.icon !== undefined) {
        updateData.icon = updates.icon;
      }

      if (updates.sort_order !== undefined) {
        updateData.sort_order = updates.sort_order;
      }

      updateData.updated_at = new Date().toISOString();

      let query = supabase
        .from('spaces')
        .update(updateData)
        .eq('id', spaceId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      if (!data) {
        throw new Error('Failed to update space');
      }

      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Delete a space (projects remain, space_id set to null)
   * @param {number} spaceId - Space ID
   * @returns {Promise<void>}
   */,
  async deleteSpace(spaceId) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Verify space exists
      const space = await this.getSpace(spaceId);
      if (!space) {
        throw new Error('Space not found');
      }

      // Delete space (projects will have space_id set to NULL via ON DELETE SET NULL)
      let query = supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId);

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Get projects in a space
   * @param {number|null|string} spaceId - Space ID (null or 'unassigned' for unassigned projects)
   * @returns {Promise<Array>} Array of projects
   */,
  async getProjectsInSpace(spaceId) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('projects')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      // Filter by space
      if (spaceId === null || spaceId === 'unassigned') {
        query = query.is('space_id', null);
      } else {
        query = query.eq('space_id', spaceId);
      }

      // Company vs personal filter
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

  /**
   * Get spaces with project counts
   * OPTIMIZED: Uses single query instead of N+1 pattern
   * @returns {Promise<Array>} Array of spaces with project_count property
   */,
  async getSpacesWithCounts() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get all spaces
      const spaces = await this.getSpaces();

      // Get ALL projects in ONE query (instead of N queries)
      let projectQuery = supabase
        .from('projects')
        .select('id, space_id');

      if (companyId) {
        projectQuery = projectQuery.eq('company_id', companyId);
      } else {
        projectQuery = projectQuery.is('company_id', null).eq('created_by', userId);
      }

      const { data: projects, error } = await projectQuery;
      if (error) throw error;

      // Count projects by space in memory (fast, no additional queries)
      const projectCountsBySpace = {};
      (projects || []).forEach(project => {
        if (project.space_id) {
          projectCountsBySpace[project.space_id] = (projectCountsBySpace[project.space_id] || 0) + 1;
        }
      });

      // Merge counts with spaces
      const spacesWithCounts = spaces.map(space => ({
        ...space,
        project_count: projectCountsBySpace[space.id] || 0,
      }));

      return spacesWithCounts;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

};

