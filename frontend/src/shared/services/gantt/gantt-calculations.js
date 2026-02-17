/**
 * Gantt Calculations Module
 * Handles critical path calculation and auto-scheduling algorithms
 */

import supabase from '../supabase.js';

/**
 * Get critical path for a project using CPM algorithm
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Array of critical path tasks with slack_days
 */
export async function getCriticalPath(projectId) {
  try {
    const { data, error } = await supabase
      .rpc('calculate_critical_path', { p_project_id: projectId });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error calculating critical path:', error);
    throw new Error(`Failed to calculate critical path: ${error.message}`);
  }
}

/**
 * Calculate earliest start date for a task based on dependencies
 * @param {number} taskId - Task ID
 * @param {Function} getDependencies - Function to get dependencies
 * @returns {Promise<Date|null>} Calculated start date or null if no dependencies
 */
export async function calculateTaskStartDate(taskId, getDependencies) {
  try {
    const dependencies = await getDependencies(taskId);

    if (dependencies.length === 0) {
      return null; // No dependencies, use current date or existing start_date
    }

    // Find latest due_date among dependencies (finish_to_start logic)
    const latestDependencyFinish = dependencies.reduce((latest, dep) => {
      const depDueDate = dep.depends_on_task?.due_date;
      if (!depDueDate) return latest;

      const dueDate = new Date(depDueDate);
      return !latest || dueDate > latest ? dueDate : latest;
    }, null);

    return latestDependencyFinish;
  } catch (error) {
    console.error('Error calculating task start date:', error);
    return null;
  }
}

/**
 * Auto-schedule tasks in a project using topological sort and forward pass
 * @param {number} projectId - Project ID
 * @param {Function} getGanttTasks - Function to get Gantt tasks
 * @param {Function} updateTaskDates - Function to update task dates
 * @returns {Promise<Object>} { updated: count, tasks: updated_tasks }
 */
export async function autoScheduleTasks(projectId, getGanttTasks, updateTaskDates) {
  try {
    // Get all tasks for the project
    const tasks = await getGanttTasks({ project_id: projectId });

    if (tasks.length === 0) {
      return { updated: 0, tasks: [] };
    }

    // Build dependency graph
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const inDegree = new Map(tasks.map(t => [t.id, 0]));
    const adjacencyList = new Map(tasks.map(t => [t.id, []]));

    // Count incoming edges (dependencies)
    tasks.forEach(task => {
      if (task.task_dependencies && task.task_dependencies.length > 0) {
        task.task_dependencies.forEach(dep => {
          inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
          if (adjacencyList.has(dep.depends_on_task_id)) {
            adjacencyList.get(dep.depends_on_task_id).push(task.id);
          }
        });
      }
    });

    // Topological sort using Kahn's algorithm
    const queue = [];
    const sortedTasks = [];

    // Start with tasks that have no dependencies
    inDegree.forEach((degree, taskId) => {
      if (degree === 0) {
        queue.push(taskId);
      }
    });

    while (queue.length > 0) {
      const taskId = queue.shift();
      sortedTasks.push(taskId);

      // Reduce in-degree for dependent tasks
      const dependents = adjacencyList.get(taskId) || [];
      dependents.forEach(depTaskId => {
        inDegree.set(depTaskId, inDegree.get(depTaskId) - 1);
        if (inDegree.get(depTaskId) === 0) {
          queue.push(depTaskId);
        }
      });
    }

    // Forward pass: Calculate start dates
    const updates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const taskId of sortedTasks) {
      const task = taskMap.get(taskId);
      if (!task) continue;

      // Skip if already has start_date and due_date
      if (task.start_date && task.due_date) continue;

      let calculatedStart = null;

      // Calculate based on dependencies
      if (task.task_dependencies && task.task_dependencies.length > 0) {
        const latestFinish = task.task_dependencies.reduce((latest, dep) => {
          const depTask = taskMap.get(dep.depends_on_task_id);
          if (!depTask?.due_date) return latest;

          const dueDate = new Date(depTask.due_date);
          return !latest || dueDate > latest ? dueDate : latest;
        }, null);

        if (latestFinish) {
          calculatedStart = new Date(latestFinish);
          calculatedStart.setDate(calculatedStart.getDate() + 1); // Start day after dependency finishes
        }
      }

      // If no dependencies or couldn't calculate, use today
      if (!calculatedStart) {
        calculatedStart = new Date(today);
      }

      // Calculate due date (default to 3 days if not set)
      let dueDate = task.due_date ? new Date(task.due_date) : null;
      if (!dueDate) {
        dueDate = new Date(calculatedStart);
        dueDate.setDate(dueDate.getDate() + 3); // Default 3-day duration
      }

      // Update task
      updates.push({
        id: taskId,
        start_date: calculatedStart.toISOString(),
        due_date: dueDate.toISOString()
      });
    }

    // Batch update tasks
    const updatedTasks = [];
    for (const update of updates) {
      try {
        const result = await updateTaskDates(update.id, {
          start_date: update.start_date,
          due_date: update.due_date
        });
        updatedTasks.push(result);
      } catch (error) {
        console.error(`Failed to update task ${update.id}:`, error);
      }
    }

    return {
      updated: updatedTasks.length,
      tasks: updatedTasks
    };
  } catch (error) {
    console.error('Error auto-scheduling tasks:', error);
    throw new Error(`Failed to auto-schedule tasks: ${error.message}`);
  }
}
