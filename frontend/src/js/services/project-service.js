/**
 * Project Service
 * Handles all project CRUD operations with company isolation
 */

import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';
import { handleError } from '@utils/error-handler.js';

/**
 * Get all projects for the user's company
 * @returns {Promise<Array>} Array of projects
 */
export async function getProjects() {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        id,
        name,
        description,
        status,
        created_by,
        created_at,
        updated_at,
        tasks(count)
      `
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

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
 * Get a single project by ID with task count
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project details
 */
export async function getProject(projectId) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        id,
        name,
        description,
        status,
        created_by,
        created_at,
        updated_at,
        tasks(count)
      `
      )
      .eq('id', projectId)
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Project not found or you do not have permission to access it');
    }

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Create a new project
 * @param {Object} projectData - { name, description, status }
 * @returns {Promise<Object>} Created project
 */
export async function createProject(projectData) {
  try {
    const { name, description = '', status = 'active' } = projectData;

    // Validation
    if (!name || name.trim() === '') {
      throw new Error('Project name is required');
    }

    if (name.length > 100) {
      throw new Error('Project name must be 100 characters or less');
    }

    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        company_id: companyId,
        name: name.trim(),
        description: description.trim() || null,
        status,
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
 * Update a project
 * @param {string} projectId - Project ID
 * @param {Object} updates - { name, description, status }
 * @returns {Promise<Object>} Updated project
 */
export async function updateProject(projectId, updates) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    // Validate the project belongs to user's company
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

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Failed to update project');
    }

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
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
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    // Verify project exists and belongs to user's company
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Delete will cascade to tasks (if cascade is set in database)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('company_id', companyId);

    if (error) throw error;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Get project statistics
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project stats
 */
export async function getProjectStats(projectId) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('status')
      .eq('project_id', projectId)
      .eq('company_id', companyId);

    if (error) throw error;

    const stats = {
      total: data.length,
      completed: data.filter((t) => t.status === 'completed').length,
      inProgress: data.filter((t) => t.status === 'in_progress').length,
      todo: data.filter((t) => t.status === 'todo').length,
      completionPercentage: data.length > 0 ? Math.round((stats.completed / data.length) * 100) : 0,
    };

    return stats;
  } catch (error) {
    console.error('Error getting project stats:', error);
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      todo: 0,
      completionPercentage: 0,
    };
  }
}

/**
 * Check if user can edit/delete a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function canModifyProject(projectId, userId) {
  try {
    const project = await getProject(projectId);
    // User can modify if they created it or are admin (handled by RLS)
    return project.created_by === userId;
  } catch (error) {
    return false;
  }
}
