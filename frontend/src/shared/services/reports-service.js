/**
 * Reports Service
 * Handles analytics, metrics, and report generation
 * Phase 3D: Reports & Analytics
 */

import supabase from './supabase.js';
import { authUtils } from '../utils/auth.js';

/**
 * Get task completion metrics
 * @param {Object} filters - { startDate, endDate, projectId, userId }
 * @returns {Promise<Object>} Completion metrics
 */
export const reportsService = {
  async getTaskCompletionMetrics(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    let query = supabase
      .from('tasks')
      .select('id, status, created_at, updated_at');

    // Apply company/personal filter
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', user.id);
    }

    // Apply date range
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    // Apply project filter
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    // Apply user filter
    if (filters.userId) {
      query = query.eq('assigned_to', filters.userId);
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    return {
      total,
      completed,
      inProgress,
      todo,
      completionRate,
      byStatus: {
        todo,
        in_progress: inProgress,
        done: completed,
      },
    };
  },

  /**
   * Get status distribution across all tasks
   * @param {Object} filters - { startDate, endDate, projectId }
   * @returns {Promise<Object>} Status distribution
   */
  async getStatusDistribution(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    let query = supabase
      .from('tasks')
      .select('id, status, project_id, created_at');

    // Apply company/personal filter
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', user.id);
    }

    // Apply filters
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    // Get custom statuses for the project (or use defaults)
    const statusCounts = {};
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });

    return statusCounts;
  },

  /**
   * Get priority distribution
   * @param {Object} filters - { startDate, endDate, projectId }
   * @returns {Promise<Object>} Priority distribution
   */
  async getPriorityDistribution(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    let query = supabase
      .from('tasks')
      .select('id, priority, status, created_at');

    // Apply company/personal filter
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', user.id);
    }

    // Apply filters
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    tasks.forEach(task => {
      priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
    });

    return priorityCounts;
  },

  /**
   * Get overdue tasks count
   * @param {Object} filters - { projectId, userId }
   * @returns {Promise<Object>} Overdue task metrics
   */
  async getOverdueMetrics(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    const now = new Date().toISOString();

    let query = supabase
      .from('tasks')
      .select('id, title, due_date, status, priority, project_id')
      .lt('due_date', now)
      .neq('status', 'done')
      .not('due_date', 'is', null);

    // Apply company/personal filter
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null).eq('created_by', user.id);
    }

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }
    if (filters.userId) {
      query = query.eq('assigned_to', filters.userId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    return {
      total: tasks.length,
      byPriority: {
        urgent: tasks.filter(t => t.priority === 'urgent').length,
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      },
      tasks: tasks,
    };
  },

  /**
   * Get time tracking summary
   * @param {Object} filters - { startDate, endDate, projectId, userId }
   * @returns {Promise<Object>} Time tracking metrics
   */
  async getTimeTrackingSummary(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    // First, get time entries with basic task info
    let query = supabase
      .from('time_entries')
      .select(`
        id,
        task_id,
        user_id,
        duration_seconds,
        start_time,
        end_time,
        tasks!inner (
          id,
          title,
          project_id,
          company_id,
          created_by
        )
      `)
      .not('duration_seconds', 'is', null);

    // Apply company filter at query level
    if (companyId) {
      query = query.eq('tasks.company_id', companyId);
    } else {
      query = query.is('tasks.company_id', null).eq('tasks.created_by', user.id);
    }

    // Apply date range
    if (filters.startDate) {
      query = query.gte('start_time', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('start_time', filters.endDate);
    }

    // Apply user filter
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    // Apply project filter
    if (filters.projectId) {
      query = query.eq('tasks.project_id', filters.projectId);
    }

    const { data: entries, error } = await query;
    if (error) throw error;

    // Get unique project IDs from entries
    const projectIds = [...new Set(entries.map(e => e.tasks?.project_id).filter(Boolean))];

    // Fetch project names separately
    const projectsMap = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projects) {
        projects.forEach(p => {
          projectsMap[p.id] = p.name;
        });
      }
    }

    // Calculate totals
    const totalSeconds = entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
    const totalHours = (totalSeconds / 3600).toFixed(2);

    // Group by user
    const byUser = {};
    entries.forEach(entry => {
      if (!byUser[entry.user_id]) {
        byUser[entry.user_id] = 0;
      }
      byUser[entry.user_id] += entry.duration_seconds || 0;
    });

    // Group by project
    const byProject = {};
    entries.forEach(entry => {
      const projectId = entry.tasks?.project_id;
      if (projectId) {
        if (!byProject[projectId]) {
          byProject[projectId] = {
            id: projectId,
            name: projectsMap[projectId] || 'Unknown',
            totalSeconds: 0,
          };
        }
        byProject[projectId].totalSeconds += entry.duration_seconds || 0;
      }
    });

    return {
      totalSeconds,
      totalHours: parseFloat(totalHours),
      entryCount: entries.length,
      byUser,
      byProject: Object.values(byProject),
    };
  },

  /**
   * Get team productivity metrics
   * @param {Object} filters - { startDate, endDate }
   * @returns {Promise<Array>} User productivity metrics
   */
  async getTeamProductivity(filters = {}) {
    const user = await authUtils.getCurrentUser();
    const companyId = user.user_metadata?.company_id || null;

    if (!companyId) {
      // Personal users don't have teams
      return [];
    }

    let query = supabase
      .from('tasks')
      .select('id, status, assigned_to, created_at, updated_at')
      .eq('company_id', companyId);

    // Apply date range
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    // Group by user
    const userMetrics = {};
    tasks.forEach(task => {
      const userId = task.assigned_to || 'unassigned';
      if (!userMetrics[userId]) {
        userMetrics[userId] = {
          userId,
          total: 0,
          completed: 0,
          inProgress: 0,
          todo: 0,
        };
      }
      userMetrics[userId].total++;
      if (task.status === 'done') userMetrics[userId].completed++;
      if (task.status === 'in_progress') userMetrics[userId].inProgress++;
      if (task.status === 'todo') userMetrics[userId].todo++;
    });

    // Calculate completion rates
    Object.values(userMetrics).forEach(metrics => {
      metrics.completionRate = metrics.total > 0
        ? ((metrics.completed / metrics.total) * 100).toFixed(1)
        : 0;
    });

    return Object.values(userMetrics);
  },

  /**
   * Get project progress metrics
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Project progress
   */
  async getProjectProgress(projectId) {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, status, priority, due_date, created_at')
      .eq('project_id', projectId);

    if (error) throw error;

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;

    // Upcoming deadlines (next 7 days)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= now && dueDate <= nextWeek;
    }).length;

    // Overdue
    const overdue = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < now;
    }).length;

    return {
      total,
      completed,
      inProgress,
      todo,
      completionPercentage: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
      upcomingDeadlines,
      overdue,
    };
  },

  /**
   * Export data to CSV
   * @param {Array} data - Array of objects to export
   * @param {string} filename - CSV filename
   */
  exportToCSV(data, filename = 'report.csv') {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Get date range presets
   * @returns {Object} Common date range presets
   */
  getDateRangePresets() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      today: {
        label: 'Today',
        startDate: today.toISOString(),
        endDate: now.toISOString(),
      },
      last7Days: {
        label: 'Last 7 Days',
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      },
      last30Days: {
        label: 'Last 30 Days',
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      },
      thisMonth: {
        label: 'This Month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        endDate: now.toISOString(),
      },
      lastMonth: {
        label: 'Last Month',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
      },
      thisYear: {
        label: 'This Year',
        startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
        endDate: now.toISOString(),
      },
    };
  }

};
