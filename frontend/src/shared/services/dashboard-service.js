/**
 * Dashboard Service
 * Provides aggregated data and statistics for the dashboard
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';
import { getStatusDefinitionsMap, isTaskCompleted } from './status-helpers.js';

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats
 */

export const dashboardService = {
  async getDashboardStats() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

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
   * Uses is_done flag from status_definitions to determine completion
   */
  async getTaskCount(companyId, userId) {
    let query = supabase
      .from('tasks')
      .select('id, project_id, status');

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    if (!tasks || tasks.length === 0) return 0;

    // Get status definitions for all projects
    const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
    const statusDefsMap = await getStatusDefinitionsMap(projectIds);

    // Count tasks that are NOT completed
    const activeTasks = tasks.filter(task => !isTaskCompleted(task, statusDefsMap));
    return activeTasks.length;
  },

  /**
   * Get tasks completed this week
   * Uses is_done flag and updated_at to determine recent completions
   */
  async getCompletedThisWeekCount(companyId, userId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let query = supabase
      .from('tasks')
      .select('id, project_id, status, updated_at')
      .gte('updated_at', weekAgo.toISOString());

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    if (!tasks || tasks.length === 0) return 0;

    // Get status definitions for all projects
    const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
    const statusDefsMap = await getStatusDefinitionsMap(projectIds);

    // Count tasks that are completed and updated this week
    const completedTasks = tasks.filter(task => isTaskCompleted(task, statusDefsMap));
    return completedTasks.length;
  },

  /**
   * Get overdue task count
   * Excludes tasks with is_done = true
   */
  async getOverdueTaskCount(companyId, userId) {
    const now = new Date().toISOString();

    let query = supabase
      .from('tasks')
      .select('id, project_id, status, due_date')
      .not('due_date', 'is', null)
      .lt('due_date', now);

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', userId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    if (!tasks || tasks.length === 0) return 0;

    // Get status definitions for all projects
    const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
    const statusDefsMap = await getStatusDefinitionsMap(projectIds);

    // Count tasks that are NOT completed
    const overdueTasks = tasks.filter(task => !isTaskCompleted(task, statusDefsMap));
    return overdueTasks.length;
  },

  /**
   * Get tasks assigned to current user
   * Excludes completed tasks based on is_done flag
   * @returns {Promise<Array>} Tasks assigned to user, grouped by status
   */
  async getMyTasks() {
    try {
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('assigned_to', userId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50); // Get more to filter

      if (error) throw error;
      if (!tasks || tasks.length === 0) return [];

      // Get status definitions for all projects
      const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
      const statusDefsMap = await getStatusDefinitionsMap(projectIds);

      // Filter out completed tasks
      const activeTasks = tasks.filter(task => !isTaskCompleted(task, statusDefsMap));

      return activeTasks.slice(0, 10); // Return top 10
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get upcoming deadlines (tasks due within 7 days)
   * Excludes completed tasks based on is_done flag
   * @returns {Promise<Array>} Tasks with upcoming due dates
   */
  async getUpcomingDeadlines() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);

      let query = supabase
        .from('tasks')
        .select('*, projects(name)')
        .not('due_date', 'is', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', weekFromNow.toISOString())
        .order('due_date', { ascending: true })
        .limit(50); // Get more to filter

      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('created_by', userId);
      }

      const { data: tasks, error } = await query;
      if (error) throw error;
      if (!tasks || tasks.length === 0) return [];

      // Get status definitions for all projects
      const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
      const statusDefsMap = await getStatusDefinitionsMap(projectIds);

      // Filter out completed tasks
      const activeTasks = tasks.filter(task => !isTaskCompleted(task, statusDefsMap));

      return activeTasks.slice(0, 10); // Return top 10
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Get project progress (completion percentage per project)
   * Uses is_done flag to determine completion
   * @returns {Promise<Array>} Projects with completion stats
   */
  async getProjectProgress() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

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
      if (!projects || projects.length === 0) return [];

      // Get status definitions for all projects
      const projectIds = projects.map(p => p.id);
      const statusDefsMap = await getStatusDefinitionsMap(projectIds);

      // Get all tasks for these projects
      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, project_id, status')
        .in('project_id', projectIds);

      if (tasksError) throw tasksError;

      // Calculate progress for each project
      const projectsWithProgress = projects.map(project => {
        const projectTasks = allTasks?.filter(t => t.project_id === project.id) || [];
        const total = projectTasks.length;
        const completed = projectTasks.filter(task => isTaskCompleted(task, statusDefsMap)).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          ...project,
          total_tasks: total,
          completed_tasks: completed,
          percentage,
        };
      });

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
      const currentUser = await authUtils.getCurrentUser();
      const userId = currentUser?.id;

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
