/**
 * Reports Queries
 * Database queries for analytics and metrics
 */

import supabase from '../supabase.js';
import { authUtils } from '../../utils/auth.js';
import { getStatusDefinitionsMap, isTaskCompleted, categorizeTaskStatus } from '../status-helpers.js';

/**
 * Get task completion metrics
 * Uses is_done flag and status categorization
 * @param {Object} filters - { startDate, endDate, projectId, userId }
 * @returns {Promise<Object>} Completion metrics
 */
export async function getTaskCompletionMetrics(filters = {}) {
  const user = await authUtils.getCurrentUser();
  const companyId = user.user_metadata?.company_id || null;

  let query = supabase
    .from('tasks')
    .select('id, project_id, status, created_at, updated_at');

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

  if (!tasks || tasks.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      todo: 0,
      completionRate: 0,
      byStatus: { todo: 0, in_progress: 0, done: 0 },
    };
  }

  // Get status definitions for all projects
  const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
  const statusDefsMap = await getStatusDefinitionsMap(projectIds);

  // Categorize tasks
  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let todo = 0;

  tasks.forEach(task => {
    const category = categorizeTaskStatus(task, statusDefsMap);
    if (category === 'completed') completed++;
    else if (category === 'in_progress') inProgress++;
    else if (category === 'todo') todo++;
  });

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
}

/**
 * Get status distribution across all tasks
 * @param {Object} filters - { startDate, endDate, projectId }
 * @returns {Promise<Object>} Status distribution
 */
export async function getStatusDistribution(filters = {}) {
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
}

/**
 * Get priority distribution
 * @param {Object} filters - { startDate, endDate, projectId }
 * @returns {Promise<Object>} Priority distribution
 */
export async function getPriorityDistribution(filters = {}) {
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
}

/**
 * Get overdue tasks count
 * Excludes tasks with is_done = true
 * @param {Object} filters - { projectId, userId }
 * @returns {Promise<Object>} Overdue task metrics
 */
export async function getOverdueMetrics(filters = {}) {
  const user = await authUtils.getCurrentUser();
  const companyId = user.user_metadata?.company_id || null;

  const now = new Date().toISOString();

  let query = supabase
    .from('tasks')
    .select('id, title, due_date, status, priority, project_id')
    .lt('due_date', now)
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

  const { data: allTasks, error } = await query;
  if (error) throw error;

  if (!allTasks || allTasks.length === 0) {
    return {
      total: 0,
      byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
      tasks: [],
    };
  }

  // Get status definitions for all projects
  const projectIds = [...new Set(allTasks.map(t => t.project_id).filter(Boolean))];
  const statusDefsMap = await getStatusDefinitionsMap(projectIds);

  // Filter out completed tasks
  const tasks = allTasks.filter(task => !isTaskCompleted(task, statusDefsMap));

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
}

/**
 * Get time tracking summary
 * @param {Object} filters - { startDate, endDate, projectId, userId }
 * @returns {Promise<Object>} Time tracking metrics
 */
export async function getTimeTrackingSummary(filters = {}) {
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
}

/**
 * Get team productivity metrics
 * Uses status categorization with is_done flag
 * @param {Object} filters - { startDate, endDate }
 * @returns {Promise<Array>} User productivity metrics
 */
export async function getTeamProductivity(filters = {}) {
  const user = await authUtils.getCurrentUser();
  const companyId = user.user_metadata?.company_id || null;

  if (!companyId) {
    // Personal users don't have teams
    return [];
  }

  let query = supabase
    .from('tasks')
    .select('id, project_id, status, assigned_to, created_at, updated_at')
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

  if (!tasks || tasks.length === 0) return [];

  // Get team members with names
  const { data: teamMembers, error: teamError } = await supabase
    .rpc('get_company_team_members', { p_company_id: companyId });

  if (teamError) {
    console.error('Error fetching team members:', teamError);
  }

  // Build user name lookup map
  const userNamesMap = {};
  teamMembers?.forEach(member => {
    const displayName = member.full_name || member.email || 'Unknown User';
    userNamesMap[member.user_id] = displayName;
  });

  // Get status definitions for all projects
  const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
  const statusDefsMap = await getStatusDefinitionsMap(projectIds);

  // Group by user and categorize statuses
  const userMetrics = {};
  tasks.forEach(task => {
    const userId = task.assigned_to || 'unassigned';
    if (!userMetrics[userId]) {
      userMetrics[userId] = {
        userId,
        userName: userId === 'unassigned' ? 'Unassigned' : (userNamesMap[userId] || userId),
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
      };
    }

    const category = categorizeTaskStatus(task, statusDefsMap);
    userMetrics[userId].total++;

    if (category === 'completed') {
      userMetrics[userId].completed++;
    } else if (category === 'in_progress') {
      userMetrics[userId].inProgress++;
    } else if (category === 'todo') {
      userMetrics[userId].todo++;
    }
  });

  // Calculate completion rates
  Object.values(userMetrics).forEach(metrics => {
    metrics.completionRate = metrics.total > 0
      ? ((metrics.completed / metrics.total) * 100).toFixed(1)
      : 0;
  });

  return Object.values(userMetrics);
}

/**
 * Get project progress metrics
 * Uses status categorization with is_done flag
 * @param {number} projectId - Project ID
 * @returns {Promise<Object>} Project progress
 */
export async function getProjectProgress(projectId) {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, project_id, status, priority, due_date, created_at')
    .eq('project_id', projectId);

  if (error) throw error;

  if (!tasks || tasks.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      todo: 0,
      completionPercentage: 0,
      upcomingDeadlines: 0,
      overdue: 0,
    };
  }

  // Get status definitions for this project
  const statusDefsMap = await getStatusDefinitionsMap([projectId]);

  // Categorize tasks
  const total = tasks.length;
  let completed = 0;
  let inProgress = 0;
  let todo = 0;

  tasks.forEach(task => {
    const category = categorizeTaskStatus(task, statusDefsMap);
    if (category === 'completed') completed++;
    else if (category === 'in_progress') inProgress++;
    else if (category === 'todo') todo++;
  });

  // Upcoming deadlines (next 7 days) - exclude completed
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = tasks.filter(t => {
    if (!t.due_date) return false;
    if (isTaskCompleted(t, statusDefsMap)) return false;
    const dueDate = new Date(t.due_date);
    return dueDate >= now && dueDate <= nextWeek;
  }).length;

  // Overdue - exclude completed
  const overdue = tasks.filter(t => {
    if (!t.due_date) return false;
    if (isTaskCompleted(t, statusDefsMap)) return false;
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
}
