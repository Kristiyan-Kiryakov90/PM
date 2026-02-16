/**
 * Activity Service
 * Handles activity log queries for displaying recent changes
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get recent activity for the user's company or personal activities
 * @param {Object} options - { limit, entity_type, entity_id }
 * @returns {Promise<Array>} Array of activity entries
 */
export const activityService = {
  async getRecentActivity(options = {}) {
    try {
      const { limit = 20, entity_type = null, entity_id = null } = options;

      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by company or personal activities
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('actor_id', userId);
      }

      // Filter by entity type if specified
      if (entity_type) {
        query = query.eq('entity_type', entity_type);
      }

      // Filter by entity ID if specified
      if (entity_id) {
        query = query.eq('entity_id', entity_id);
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
   * Get activity for a specific task
   * @param {number} taskId - Task ID
   * @param {number} limit - Maximum number of entries
   * @returns {Promise<Array>} Array of activity entries
   */
  async getTaskActivity(taskId, limit = 50) {
    return this.getRecentActivity({
      entity_type: 'task',
      entity_id: taskId,
      limit,
    });
  },

  /**
   * Get activity for a specific project
   * @param {number} projectId - Project ID
   * @param {number} limit - Maximum number of entries
   * @returns {Promise<Array>} Array of activity entries
   */
  async getProjectActivity(projectId, limit = 50) {
    return this.getRecentActivity({
      entity_type: 'project',
      entity_id: projectId,
      limit,
    });
  },

  /**
   * Get activity by user (actor)
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of entries
   * @returns {Promise<Array>} Array of activity entries
   */
  async getUserActivity(userId, limit = 20) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const currentUserId = user.data?.user?.id;

      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by company or personal activities
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null);
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
   * Get activity statistics for dashboard
   * @returns {Promise<Object>} Activity stats
   */
  async getActivityStats() {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get activity from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let query = supabase
        .from('activity_log')
        .select('action, entity_type, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      // Filter by company or personal activities
      if (companyId) {
        query = query.eq('company_id', companyId);
      } else {
        query = query.is('company_id', null).eq('actor_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Count by action type
      const stats = {
        total: data.length,
        created: data.filter((a) => a.action === 'created').length,
        updated: data.filter((a) => a.action === 'updated').length,
        deleted: data.filter((a) => a.action === 'deleted').length,
        status_changed: data.filter((a) => a.action === 'status_changed').length,
        commented: data.filter((a) => a.action === 'commented').length,
        by_entity: {
          task: data.filter((a) => a.entity_type === 'task').length,
          project: data.filter((a) => a.entity_type === 'project').length,
          comment: data.filter((a) => a.entity_type === 'comment').length,
          attachment: data.filter((a) => a.entity_type === 'attachment').length,
        },
      };

      return stats;
    } catch (error) {
      errorHandler.handleError(error, { showAlert: false, logError: true });
      throw error;
    }
  },

  /**
   * Subscribe to real-time activity updates
   * @param {Function} callback - Callback(payload)
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeToActivity(callback) {
    const channel = supabase
      .channel('activity_log_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => supabase.removeChannel(channel),
    };
  },

  /**
   * Format activity entry for display
   * @param {Object} activity - Activity log entry
   * @returns {Object} Formatted activity with icon, color, and message
   */
  formatActivity(activity) {
    const { entity_type, action, details } = activity;

    let icon = '📝';
    let color = 'primary';
    let message = '';

    // Determine icon and color based on action
    switch (action) {
      case 'created':
        icon = '➕';
        color = 'success';
        message = `Created ${entity_type}`;
        if (details.title) message += `: ${details.title}`;
        if (details.name) message += `: ${details.name}`;
        break;

      case 'updated':
        icon = '✏️';
        color = 'info';
        message = `Updated ${entity_type}`;
        // For tasks, use title
        if (details.title) {
          message += `: ${details.title.new || details.title.old}`;
        }
        // For projects, use project_name or name changes
        if (entity_type === 'project') {
          if (details.project_name) {
            message += `: ${details.project_name}`;
          } else if (details.name) {
            message += `: ${details.name.new || details.name.old}`;
          }
        } else if (details.name) {
          // For other entities
          message += `: ${details.name.new || details.name.old}`;
        }
        break;

      case 'deleted':
        icon = '🗑️';
        color = 'danger';
        message = `Deleted ${entity_type}`;
        if (details.title) message += `: ${details.title}`;
        if (details.name) message += `: ${details.name}`;
        break;

      case 'status_changed':
        icon = '🔄';
        color = 'warning';
        message = `Changed status from ${details.old_status} to ${details.new_status}`;
        break;

      case 'assigned':
        icon = '👤';
        color = 'primary';
        if (details.new_assignee) {
          message = `Assigned task`;
        } else {
          message = `Unassigned task`;
        }
        break;

      case 'commented':
        icon = '💬';
        color = 'info';
        message = `Commented on ${entity_type}`;
        if (details.is_action_item) {
          icon = '✅';
          message = `Added action item`;
        }
        break;

      default:
        icon = '📝';
        color = 'secondary';
        message = `${action} ${entity_type}`;
    }

    return {
      ...activity,
      icon,
      color,
      message,
    };
  },

  /**
   * Get detailed changes from activity details
   * @param {Object} details - Activity details jsonb
   * @returns {Array<Object>} Array of { field, oldValue, newValue }
   */
  getActivityChanges(details) {
    const changes = [];

    for (const [field, value] of Object.entries(details)) {
      if (typeof value === 'object' && value !== null && 'old' in value && 'new' in value) {
        changes.push({
          field,
          oldValue: value.old,
          newValue: value.new,
        });
      }
    }

    return changes;
  }

};
