/**
 * Dashboard Service
 * Provides aggregated data and statistics for the dashboard
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats
 */

export const dashboardService = {
  async getDashboardStats() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get counts in parallel
      const [projectsResult, tasksResult, completedThisWeekResult, overdueResult] = await Promise.all([
        this.getProjectCount(companyId, userId),
        this.getTaskCount(companyId, userId),
        this.getCompletedThisWeekCount(companyId, userId),
        this.getOverdueTaskCount(companyId, userId),
      ]);

      return {
        totalProjects: projectsResult,
        activeTasks: tasksResult,
        completedThisWeek: completedThisWeekResult,
        overdueTasks: overdueResult,
      };
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get total project count
   */
  async getProjectCount(companyId, userId) {
    let query = supabase
      .from('projects')
      .select('id', { count: 'exact', head: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Get active task count (not done)
   */
  async getTaskCount(companyId, userId) {
    let query = supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .is('completed_at', null);

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Get tasks completed this week
   */
  async getCompletedThisWeekCount(companyId, userId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let query = supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .gte('completed_at', weekAgo.toISOString());

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Get overdue task count
   */
  async getOverdueTaskCount(companyId, userId) {
    const now = new Date().toISOString();

    let query = supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .is('completed_at', null)
      .not('due_date', 'is', null)
      .lt('due_date', now);

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Get tasks assigned to current user
   * @returns {Promise<Array>} Tasks assigned to user, grouped by status
   */
  async getMyTasks() {
    try {
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('assigned_to', userId)
        .is('completed_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get upcoming deadlines (tasks due within 7 days)
   * @returns {Promise<Array>} Tasks with upcoming due dates
   */
  async getUpcomingDeadlines() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      let query = supabase
        .from('tasks')
        .select('*, projects(name)')
        .is('completed_at', null)
        .not('due_date', 'is', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', weekFromNow.toISOString())
        .order('due_date', { ascending: true })
        .limit(10);

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
  },

  /**
   * Get project progress (completion percentage per project)
   * @returns {Promise<Array>} Projects with completion stats
   */
  async getProjectProgress() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get all projects
      let projectQuery = supabase
        .from('projects')
        .select('id, name, color, icon')
        .order('name', { ascending: true })
        .limit(5);

      if (companyId) {
        projectQuery = projectQuery.eq('company_id', companyId);
      } else {
        projectQuery = projectQuery.is('company_id', null).eq('created_by', userId);
      }

      const { data: projects, error: projectsError } = await projectQuery;
      if (projectsError) throw projectsError;

      // Get task counts for each project
      const projectsWithProgress = await Promise.all(
        (projects || []).map(async (project) => {
          const [totalResult, completedResult] = await Promise.all([
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', project.id),
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', project.id)
              .not('completed_at', 'is', null),
          ]);

          const total = totalResult.count || 0;
          const completed = completedResult.count || 0;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

          return {
            ...project,
            total_tasks: total,
            completed_tasks: completed,
            percentage,
          };
        })
      );

      return projectsWithProgress;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get recent activity (placeholder - requires activity_log table from Phase 2B)
   * @returns {Promise<Array>} Recent activity items
   */
  async getRecentActivity() {
    try {
      // Placeholder: will implement fully in Phase 2B (Activity Log)
      // For now, return recent tasks as a proxy
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('tasks')
        .select('*, projects(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform to activity format
      return (data || []).map(task => ({
        id: task.id,
        type: 'task_created',
        description: `Created task "${task.title}"`,
        project_name: task.projects?.name || 'Unknown Project',
        created_at: task.created_at,
      }));
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  }

};
