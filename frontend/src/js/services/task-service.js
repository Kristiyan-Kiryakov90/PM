/**
 * Task Service
 * Handles all task CRUD operations with company isolation
 */

import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';
import { handleError } from '@utils/error-handler.js';

/**
 * Get all tasks for the user's company with optional filters
 * @param {Object} filters - { project_id, status, assignee_id }
 * @returns {Promise<Array>} Array of tasks
 */
export async function getTasks(filters = {}) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
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
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

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
}

/**
 * Get a single task by ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Task details
 */
export async function getTask(taskId) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
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
        due_date,
        created_by,
        created_at,
        updated_at,
        projects:project_id (
          id,
          name
        ),
        attachments (
          id,
          file_name,
          file_size,
          created_at
        )
      `
      )
      .eq('id', taskId)
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Task not found or you do not have permission to access it');
    }

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Create a new task
 * @param {Object} taskData - { title, description, status, priority, project_id, assignee_id, due_date }
 * @returns {Promise<Object>} Created task
 */
export async function createTask(taskData) {
  try {
    const {
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      project_id,
      assigned_to = null,
      due_date = null,
    } = taskData;

    // Validation
    if (!title || title.trim() === '') {
      throw new Error('Task title is required');
    }

    if (title.length > 200) {
      throw new Error('Task title must be 200 characters or less');
    }

    if (!project_id) {
      throw new Error('Project is required');
    }

    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        project_id,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        created_by: (await supabase.auth.getUser()).data?.user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Update a task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated task
 */
export async function updateTask(taskId, updates) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    // Validate the task belongs to user's company
    const existing = await getTask(taskId);
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
      const validStatuses = ['todo', 'in_progress', 'review', 'done'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = updates.status;
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

    if (updates.due_date !== undefined) {
      updateData.due_date = updates.due_date || null;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Failed to update task');
    }

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Delete a task
 * @param {string} taskId - Task ID
 * @returns {Promise<void>}
 */
export async function deleteTask(taskId) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    // Verify task exists and belongs to user's company
    const task = await getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Delete will cascade to attachments (if cascade is set in database)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('company_id', companyId);

    if (error) throw error;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Get all company users for assignee dropdown
 * @returns {Promise<Array>} Array of users
 */
export async function getCompanyUsers() {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
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
