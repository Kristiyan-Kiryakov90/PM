/**
 * Project Queries
 * Statistics and aggregation queries for projects
 */

import supabase from '../supabase.js';
import { authUtils } from '@utils/auth.js';

/**
 * Get project statistics
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project stats
 */
export async function getProjectStats(projectId) {
  try {
    const companyId = await authUtils.getUserCompanyId();
    const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('tasks')
      .select('status')
      .eq('project_id', projectId);

    // Filter by company or personal ownership
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const completed = data.filter((t) => t.status === 'completed').length;
    const stats = {
      total: data.length,
      completed,
      inProgress: data.filter((t) => t.status === 'in_progress').length,
      todo: data.filter((t) => t.status === 'todo').length,
      completionPercentage: data.length > 0 ? Math.round((completed / data.length) * 100) : 0,
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
    const { getProject } = await import('./project-crud.js');
    const project = await getProject(projectId);
    // User can modify if they created it or are admin (handled by RLS)
    return project.created_by === userId;
  } catch (error) {
    return false;
  }
}
