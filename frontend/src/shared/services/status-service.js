/**
 * Status Service
 * Handles custom status definitions for projects
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get all statuses for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Array of status definitions, sorted by sort_order
 */

export const statusService = {
  async getProjectStatuses(projectId) {
    try {
      const { data, error } = await supabase
        .from('status_definitions')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get a single status definition
   * @param {number} statusId - Status ID
   * @returns {Promise<Object>} Status definition
   */
  async getStatus(statusId) {
    try {
      const { data, error } = await supabase
        .from('status_definitions')
        .select('*')
        .eq('id', statusId)
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('Status not found');
      }
      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Create a new status for a project
   * @param {Object} statusData - { project_id, name, slug, color, sort_order, is_done, is_default }
   * @returns {Promise<Object>} Created status
   */
  async createStatus(statusData) {
    try {
      const {
        project_id,
        name,
        slug,
        color = '#6b7280',
        sort_order = 0,
        is_done = false,
        is_default = false,
      } = statusData;

      // Validation
      if (!project_id) {
        throw new Error('Project ID is required');
      }
      if (!name || name.trim() === '') {
        throw new Error('Status name is required');
      }
      if (!slug || slug.trim() === '') {
        throw new Error('Status slug is required');
      }
      if (name.length > 50) {
        throw new Error('Status name must be 50 characters or less');
      }
      if (slug.length > 50) {
        throw new Error('Status slug must be 50 characters or less');
      }
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new Error('Color must be a valid hex code (e.g., #3b82f6)');
      }

      // Get company_id from project
      const { data: project } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', project_id)
        .single();

      if (!project) {
        throw new Error('Project not found');
      }

      const { data, error } = await supabase
        .from('status_definitions')
        .insert({
          company_id: project.company_id,
          project_id,
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          color,
          sort_order,
          is_done,
          is_default,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Update a status definition
   * @param {number} statusId - Status ID
   * @param {Object} updates - { name, slug, color, sort_order, is_done, is_default }
   * @returns {Promise<Object>} Updated status
   */
  async updateStatus(statusId, updates) {
    try {
      // Validate the status exists
      const existing = await this.getStatus(statusId);
      if (!existing) {
        throw new Error('Status not found');
      }

      // Build update object
      const updateData = {};

      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim() === '') {
          throw new Error('Status name cannot be empty');
        }
        if (updates.name.length > 50) {
          throw new Error('Status name must be 50 characters or less');
        }
        updateData.name = updates.name.trim();
      }

      if (updates.slug !== undefined) {
        if (!updates.slug || updates.slug.trim() === '') {
          throw new Error('Status slug cannot be empty');
        }
        if (updates.slug.length > 50) {
          throw new Error('Status slug must be 50 characters or less');
        }
        updateData.slug = updates.slug.trim().toLowerCase();
      }

      if (updates.color !== undefined) {
        if (updates.color && !/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
          throw new Error('Color must be a valid hex code');
        }
        updateData.color = updates.color;
      }

      if (updates.sort_order !== undefined) {
        updateData.sort_order = updates.sort_order;
      }

      if (updates.is_done !== undefined) {
        updateData.is_done = updates.is_done;
      }

      if (updates.is_default !== undefined) {
        updateData.is_default = updates.is_default;
      }

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('status_definitions')
        .update(updateData)
        .eq('id', statusId)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('Failed to update status');
      }

      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Delete a status definition
   * WARNING: This may affect existing tasks using this status
   * @param {number} statusId - Status ID
   * @returns {Promise<void>}
   */
  async deleteStatus(statusId) {
    try {
      // Verify status exists
      const status = await this.getStatus(statusId);
      if (!status) {
        throw new Error('Status not found');
      }

      // Check if there are tasks using this status
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', status.project_id)
        .eq('status', status.slug)
        .limit(1);

      if (tasksError) throw tasksError;

      if (tasks && tasks.length > 0) {
        throw new Error('Cannot delete status: tasks are using this status. Please reassign tasks first.');
      }

      const { error } = await supabase
        .from('status_definitions')
        .delete()
        .eq('id', statusId);

      if (error) throw error;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Reorder statuses for a project
   * @param {number} projectId - Project ID
   * @param {Array<{id: number, sort_order: number}>} statusOrders - Array of status IDs with new sort orders
   * @returns {Promise<void>}
   */
  async reorderStatuses(projectId, statusOrders) {
    try {
      // Update each status with new sort_order
      const updates = statusOrders.map(({ id, sort_order }) =>
        supabase
          .from('status_definitions')
          .update({ sort_order, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('project_id', projectId)
      );

      const results = await Promise.all(updates);

      // Check for errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error('Failed to reorder some statuses');
      }
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get the default status for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Default status definition
   */
  async getDefaultStatus(projectId) {
    try {
      const { data, error } = await supabase
        .from('status_definitions')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_default', true)
        .single();

      if (error) {
        // If no default found, return first status
        const statuses = await this.getProjectStatuses(projectId);
        return statuses[0] || null;
      }

      return data;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Set a status as the default for a project
   * (Unsets all other statuses as default first)
   * @param {number} projectId - Project ID
   * @param {number} statusId - Status ID to set as default
   * @returns {Promise<void>}
   */
  async setDefaultStatus(projectId, statusId) {
    try {
      // First, unset all defaults for this project
      await supabase
        .from('status_definitions')
        .update({ is_default: false })
        .eq('project_id', projectId);

      // Then set the new default
      const { error } = await supabase
        .from('status_definitions')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', statusId)
        .eq('project_id', projectId);

      if (error) throw error;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get task count per status for a project
   * OPTIMIZED: Uses single query instead of N+1 pattern
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Array of statuses with task counts
   */
  async getStatusesWithTaskCounts(projectId) {
    try {
      // Get all statuses for the project
      const statuses = await this.getProjectStatuses(projectId);

      // Get ALL tasks for the project in ONE query (instead of N queries)
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId);

      if (error) throw error;

      // Count tasks by status in memory (fast, no additional queries)
      const taskCountsByStatus = {};
      (tasks || []).forEach(task => {
        taskCountsByStatus[task.status] = (taskCountsByStatus[task.status] || 0) + 1;
      });

      // Merge counts with statuses
      const statusesWithCounts = statuses.map(status => ({
        ...status,
        task_count: taskCountsByStatus[status.slug] || 0,
      }));

      return statusesWithCounts;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

};
