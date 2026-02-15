/**
 * Task Service
 * Handles all task CRUD operations with company isolation
 */

import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';
import { handleError } from '@utils/error-handler.js';

export const taskService = {
  /**
   * Get all tasks for the user (company or personal) with optional filters
   * @param {Object} filters - { project_id, status, assignee_id }
   * @returns {Promise<Array>} Array of tasks
   */
  async getTasks(filters = {}) {
    try {
      const companyId = await getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('tasks')
        .select(
          `
          id,
          title,
          description,
          status,
          priority,
          project_id,
          assigned_to,
          start_date,
          due_date,
          created_by,
          created_at,
          updated_at,
          projects:project_id (
            id,
            name
          )
        `
        )
        .order('created_at', { ascending: false });

      // Filter by company or personal ownership
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      // Apply filters
      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      handleError(error, {
        showAlert: false,
        logError: true,
      });
      throw error;
    }
  },

  /**
   * Get a single task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task details
   */
  async getTask(taskId) {
    try {
      const companyId = await getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('tasks')
        .select(
          `
          id,
          title,
          description,
          status,
          priority,
          project_id,
          assigned_to,
          start_date,
          due_date,
          created_by,
          created_at,
          updated_at,
          projects:project_id (
            id,
            name
          ),
          attachments!attachments_task_id_fkey (
            id,
            file_name,
            file_size,
            created_at
          )
        `
        )
        .eq('id', taskId);

      // Filter by company or personal ownership
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      if (!data) {
        throw new Error('Task not found or you do not have permission to access it');
      }

      return data;
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Create a new task (company or personal)
   * @param {Object} taskData - { title, description, status, priority, project_id, assignee_id, due_date }
   * @returns {Promise<Object>} Created task
   */
  async createTask(taskData) {
    try {
      const {
        title,
        description = '',
        status = 'todo',
        priority = 'medium',
        project_id,
        assigned_to = null,
        start_date = null,
        due_date = null,
      } = taskData;

      // Validation
      if (!title || title.trim() === '') {
        throw new Error('Task title is required');
      }

      if (title.length > 200) {
        throw new Error('Task title must be 200 characters or less');
      }

      // Project is optional - tasks can exist without a project

      const companyId = await getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          company_id: companyId || null, // null for personal tasks
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          project_id,
          assigned_to: assigned_to || null,
          start_date: start_date || null,
          due_date: due_date || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, updates) {
    try {
      const companyId = await getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Validate the task belongs to user (company or personal)
      const existing = await this.getTask(taskId);
      if (!existing) {
        throw new Error('Task not found');
      }

      // Build update object, only include provided fields
      const updateData = {};

      if (updates.title !== undefined) {
        if (!updates.title || updates.title.trim() === '') {
          throw new Error('Task title cannot be empty');
        }
        if (updates.title.length > 200) {
          throw new Error('Task title must be 200 characters or less');
        }
        updateData.title = updates.title.trim();
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description.trim() || null;
      }

      if (updates.status !== undefined) {
        // Validate status is a non-empty string (custom statuses are now supported per project)
        if (typeof updates.status !== 'string' || updates.status.trim() === '') {
          throw new Error('Status must be a non-empty string');
        }
        updateData.status = updates.status.trim();
      }

      if (updates.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(updates.priority)) {
          throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
        }
        updateData.priority = updates.priority;
      }

      if (updates.project_id !== undefined) {
        updateData.project_id = updates.project_id;
      }

      if (updates.assigned_to !== undefined) {
        updateData.assigned_to = updates.assigned_to || null;
      }

      if (updates.start_date !== undefined) {
        updateData.start_date = updates.start_date || null;
      }

      if (updates.due_date !== undefined) {
        updateData.due_date = updates.due_date || null;
      }

      updateData.updated_at = new Date().toISOString();

      let query = supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      // Filter by company or personal ownership
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      if (!data) {
        throw new Error('Failed to update task');
      }

      return data;
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @returns {Promise<void>}
   */
  async deleteTask(taskId) {
    try {
      const companyId = await getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Verify task exists and belongs to user (company or personal)
      const task = await this.getTask(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Delete will cascade to attachments (if cascade is set in database)
      let query = supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      // Filter by company or personal ownership
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { error } = await query;

      if (error) throw error;
    } catch (error) {
      handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get all company users for assignee dropdown
   * Returns empty array for personal users (no company)
   * @returns {Promise<Array>} Array of users
   */
  async getCompanyUsers() {
    try {
      const companyId = await getUserCompanyId();

      // Personal users can't assign tasks to others
      if (!companyId) {
        return [];
      }

      // Note: Since user data is in auth.users metadata, we need to query auth
      // For now, we'll fetch from auth session and company context
      // In a real app, you might have a users table or use Supabase Auth Admin API

      // Temporary solution: return empty array
      // TODO: Implement proper user listing when user management is added
      return [];
    } catch (error) {
      console.error('Error getting company users:', error);
      return [];
    }
  }
};
