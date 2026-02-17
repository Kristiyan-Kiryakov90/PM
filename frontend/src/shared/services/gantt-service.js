/**
 * Gantt Service - Main Module
 * Manages task dependencies, queries, and coordinates scheduling
 */

import supabase from './supabase.js';
import {
  getCriticalPath,
  calculateTaskStartDate as calcTaskStartDate,
  autoScheduleTasks as autoSchedule,
} from './gantt/gantt-calculations.js';
import {
  moveTaskUp as moveUp,
  moveTaskDown as moveDown,
  rebuildAutoDependencies as rebuild,
} from './gantt/gantt-dependencies.js';

/**
 * Gantt Service
 */
export const ganttService = {
  // ========================================
  // Query Functions
  // ========================================

  /**
   * Get tasks with dependencies for Gantt chart
   * @param {Object} filters - Filter options (project_id, status, sort_by, etc.)
   * @returns {Promise<Array>} Tasks with dependency information
   */
  async getGanttTasks(filters = {}) {
    try {
      const sortBy = filters.sort_by || 'gantt_position'; // Default to gantt_position for vertical order
      const sortAscending = filters.sort_ascending !== false; // Default to ascending

      let query = supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          project_id,
          company_id,
          assigned_to,
          start_date,
          due_date,
          created_by,
          created_at,
          updated_at,
          gantt_position,
          projects:project_id (id, name, color),
          task_dependencies!task_id (
            id,
            depends_on_task_id,
            dependency_type,
            depends_on_task:depends_on_task_id (id, title, due_date, status)
          ),
          task_tags (
            tags (id, name, color)
          ),
          checklists (
            id,
            checklist_items (
              id,
              is_completed
            )
          )
        `);

      // Apply sorting based on sort_by parameter
      if (sortBy === 'priority') {
        // Custom priority sorting: urgent > high > medium > low
        query = query.order('priority', { ascending: false }); // Will need client-side sort for proper order
      } else if (sortBy === 'gantt_position') {
        // Sort by gantt_position for custom vertical order
        query = query.order('gantt_position', { ascending: true, nullsFirst: false });
      } else {
        query = query.order(sortBy, { ascending: sortAscending, nullsFirst: false });
      }

      // Apply filters at database level (prevents loading unnecessary data)
      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      // Note: Tag filtering requires client-side filtering due to many-to-many relationship

      const { data, error } = await query;

      if (error) throw error;

      let tasks = data || [];

      // Client-side sorting for priority (urgent > high > medium > low)
      if (sortBy === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        tasks.sort((a, b) => {
          const aPriority = priorityOrder[a.priority] ?? 4;
          const bPriority = priorityOrder[b.priority] ?? 4;
          return sortAscending ? aPriority - bPriority : bPriority - aPriority;
        });
      }

      return tasks;
    } catch (error) {
      console.error('Error fetching Gantt tasks:', error);
      throw new Error(`Failed to fetch Gantt tasks: ${error.message}`);
    }
  },

  /**
   * Get dependencies for a specific task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Array of dependency objects
   */
  async getDependencies(taskId) {
    try {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          *,
          depends_on_task:depends_on_task_id (id, title, status, due_date)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching dependencies:', error);
      throw new Error(`Failed to fetch dependencies: ${error.message}`);
    }
  },

  /**
   * Get tasks that depend on a specific task (blocking relationships)
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} Array of tasks that are blocked by this task
   */
  async getBlockedTasks(taskId) {
    try {
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          *,
          task:task_id (id, title, status, start_date, due_date)
        `)
        .eq('depends_on_task_id', taskId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching blocked tasks:', error);
      throw new Error(`Failed to fetch blocked tasks: ${error.message}`);
    }
  },

  // ========================================
  // Mutation Functions
  // ========================================

  /**
   * Add a task dependency
   * @param {Object} dependency - { task_id, depends_on_task_id, dependency_type }
   * @returns {Promise<Object>} Created dependency
   */
  async addDependency({ task_id, depends_on_task_id, dependency_type = 'finish_to_start' }) {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Get task to determine company_id
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('company_id')
        .eq('id', task_id)
        .single();

      if (taskError) throw taskError;

      // Create dependency
      const { data, error } = await supabase
        .from('task_dependencies')
        .insert({
          task_id,
          depends_on_task_id,
          dependency_type,
          company_id: task.company_id,
          created_by: user.id
        })
        .select()
        .single();

      if (error) {
        // Check for circular dependency error
        if (error.message?.includes('circular')) {
          throw new Error('Cannot add dependency: Creates a circular dependency chain');
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding dependency:', error);
      throw error;
    }
  },

  /**
   * Remove a task dependency
   * @param {number} taskId - Task ID
   * @param {number} dependsOnTaskId - Depends on task ID
   * @returns {Promise<void>}
   */
  async removeDependency(taskId, dependsOnTaskId) {
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('task_id', taskId)
        .eq('depends_on_task_id', dependsOnTaskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing dependency:', error);
      throw new Error(`Failed to remove dependency: ${error.message}`);
    }
  },

  /**
   * Update task dates (start_date and due_date)
   * @param {number} taskId - Task ID
   * @param {Object} dates - { start_date, due_date }
   * @returns {Promise<Object>} Updated task
   */
  async updateTaskDates(taskId, { start_date, due_date }) {
    try {
      const updates = {};
      if (start_date !== undefined) updates.start_date = start_date;
      if (due_date !== undefined) updates.due_date = due_date;

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating task dates:', error);
      throw new Error(`Failed to update task dates: ${error.message}`);
    }
  },

  // ========================================
  // Calculation Functions (Delegated)
  // ========================================

  /**
   * Get critical path for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Array>} Critical path tasks
   */
  async getCriticalPath(projectId) {
    return getCriticalPath(projectId);
  },

  /**
   * Calculate task start date based on dependencies
   * @param {number} taskId - Task ID
   * @returns {Promise<Date|null>} Calculated start date
   */
  async calculateTaskStartDate(taskId) {
    return calcTaskStartDate(taskId, this.getDependencies.bind(this));
  },

  /**
   * Auto-schedule tasks in a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} { updated, tasks }
   */
  async autoScheduleTasks(projectId) {
    return autoSchedule(
      projectId,
      this.getGanttTasks.bind(this),
      this.updateTaskDates.bind(this)
    );
  },

  // ========================================
  // Dependency Functions (Delegated)
  // ========================================

  /**
   * Move task up in Gantt order
   * @param {number} taskId - Task ID
   * @param {number} projectId - Project ID
   * @returns {Promise<void>}
   */
  async moveTaskUp(taskId, projectId) {
    return moveUp(taskId, projectId, this.getGanttTasks.bind(this));
  },

  /**
   * Move task down in Gantt order
   * @param {number} taskId - Task ID
   * @param {number} projectId - Project ID
   * @returns {Promise<void>}
   */
  async moveTaskDown(taskId, projectId) {
    return moveDown(taskId, projectId, this.getGanttTasks.bind(this));
  },

  /**
   * Rebuild auto-dependencies based on gantt_position
   * @param {number} projectId - Project ID
   * @returns {Promise<{created: number}>}
   */
  async rebuildAutoDependencies(projectId) {
    return rebuild(projectId, this.getGanttTasks.bind(this));
  },

  // ========================================
  // Validation Functions
  // ========================================

  /**
   * Validate that a task has required dates for Gantt display
   * @param {Object} task - Task object
   * @returns {boolean} True if task can be displayed on Gantt
   */
  canDisplayOnGantt(task) {
    return !!(task.start_date && task.due_date);
  },

  /**
   * Get count of tasks missing dates
   * @param {Array} tasks - Array of tasks
   * @returns {number} Count of tasks without start_date or due_date
   */
  getMissingDatesCount(tasks) {
    return tasks.filter(t => !this.canDisplayOnGantt(t)).length;
  },
};
