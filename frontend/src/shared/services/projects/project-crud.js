/**
 * Project CRUD Operations
 * Create, Read, Update, Delete operations for projects
 */

import supabase from '../supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get all projects for the user (company or personal)
 * @param {Object} options - Filter options
 * @param {string} options.status - Filter by status (active, paused, archived)
 * @param {boolean} options.includeTaskCounts - Whether to include task counts (slower)
 * @returns {Promise<Array>} Array of projects
 */
export async function getProjects(options = {}) {
  try {
    const { status, includeTaskCounts = false } = options;
    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // If user has a company, get company projects
    // If no company, get personal projects (where created_by = user_id and company_id is null)
    let query = supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        start_year,
        end_year,
        created_by,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    const projects = data || [];

    // Only get task counts if explicitly requested (slower operation)
    if (includeTaskCounts && projects.length > 0) {
      // Get all task counts in one query for better performance
      const projectIds = projects.map(p => p.id);
      const { data: taskCounts } = await supabase
        .from('tasks')
        .select('project_id')
        .in('project_id', projectIds);

      // Count tasks per project
      const countsMap = {};
      taskCounts?.forEach(task => {
        countsMap[task.project_id] = (countsMap[task.project_id] || 0) + 1;
      });

      // Add counts to projects
      projects.forEach(project => {
        project.tasks = [{ count: countsMap[project.id] || 0 }];
      });
    }

    return projects;
  } catch (error) {
    errorHandler.handleError(error, {
      showAlert: false,
      logError: true,
    });
    throw error;
  }
}

/**
 * Get a single project by ID with task count
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project details
 */
export async function getProject(projectId) {
  try {
    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('projects')
      .select(`
        id,
        name,
        description,
        status,
        start_year,
        end_year,
        created_by,
        created_at,
        updated_at
      `)
      .eq('id', projectId);

    // Filter by company or personal ownership
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data, error } = await query.single();

    if (error) throw error;
    if (!data) {
      throw new Error('Project not found or you do not have permission to access it');
    }

    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Create a new project (company or personal)
 * @param {Object} projectData - { name, description, status }
 * @returns {Promise<Object>} Created project
 */
export async function createProject(projectData) {
  try {
    const { name, description = '', status = 'active', start_year, end_year } = projectData;

    // Validation
    if (!name || name.trim() === '') {
      throw new Error('Project name is required');
    }

    if (name.length > 100) {
      throw new Error('Project name must be 100 characters or less');
    }

    // Prevent creating archived projects
    if (status === 'archived') {
      throw new Error('Cannot create a project with archived status. Please use active or paused.');
    }

    // Validate years
    if (start_year && end_year && parseInt(end_year) < parseInt(start_year)) {
      throw new Error('End year cannot be before start year');
    }

    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const insertData = {
      company_id: companyId || null, // null for personal projects
      name: name.trim(),
      description: description.trim() || null,
      status,
      created_by: userId,
    };

    // Add years if provided
    if (start_year) insertData.start_year = parseInt(start_year);
    if (end_year) insertData.end_year = parseInt(end_year);

    const { data, error } = await supabase
      .from('projects')
      .insert(insertData)
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
 * Update a project
 * @param {string} projectId - Project ID
 * @param {Object} updates - { name, description, status }
 * @returns {Promise<Object>} Updated project
 */
export async function updateProject(projectId, updates) {
  try {
    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Validate the project belongs to user (company or personal)
    const existing = await getProject(projectId);
    if (!existing) {
      throw new Error('Project not found');
    }

    // Build update object, only include provided fields
    const updateData = {};

    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim() === '') {
        throw new Error('Project name cannot be empty');
      }
      if (updates.name.length > 100) {
        throw new Error('Project name must be 100 characters or less');
      }
      updateData.name = updates.name.trim();
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description.trim() || null;
    }

    if (updates.status !== undefined) {
      const validStatuses = ['active', 'archived', 'paused'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = updates.status;
    }

    if (updates.start_year !== undefined) {
      updateData.start_year = updates.start_year ? parseInt(updates.start_year) : null;
    }

    if (updates.end_year !== undefined) {
      updateData.end_year = updates.end_year ? parseInt(updates.end_year) : null;
    }

    // Validate years
    if (updateData.start_year && updateData.end_year && updateData.end_year < updateData.start_year) {
      throw new Error('End year cannot be before start year');
    }

    updateData.updated_at = new Date().toISOString();

    let query = supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    // Filter by company or personal ownership
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data, error } = await query.select().single();

    if (error) throw error;
    if (!data) {
      throw new Error('Failed to update project');
    }

    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Delete a project
 * @param {string} projectId - Project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(projectId) {
  try {
    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Verify project exists and belongs to user (company or personal)
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // First, delete all tasks associated with this project
    // (RLS prevents automatic cascade, so we do it manually)
    let deleteTasksQuery = supabase
      .from('tasks')
      .delete()
      .eq('project_id', projectId);

    // Filter by company or personal ownership
    if (companyId) {
      deleteTasksQuery = deleteTasksQuery.eq('company_id', companyId);
    } else {
      deleteTasksQuery = deleteTasksQuery.is('company_id', null);
    }

    const { error: tasksError } = await deleteTasksQuery;
    if (tasksError) throw new Error(`Failed to delete tasks: ${tasksError.message}`);

    // Then delete the project itself
    let projectQuery = supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    // Filter by company or personal ownership
    if (companyId) {
      projectQuery = projectQuery.eq('company_id', companyId);
    } else {
      projectQuery = projectQuery.is('company_id', null).eq('created_by', userId);
    }

    const { error } = await projectQuery;

    if (error) throw error;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}
