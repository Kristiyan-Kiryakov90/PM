import supabase from './supabase.js';

/**
 * Gantt Service - Manages task dependencies, scheduling, and critical path
 */

// ========================================
// Query Functions
// ========================================

/**
 * Get tasks with dependencies for Gantt chart
 * @param {Object} filters - Filter options (project_id, status, sort_by, etc.)
 * @returns {Promise<Array>} Tasks with dependency information
 */
export async function getGanttTasks(filters = {}) {
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

    // Apply filters
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

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
}

/**
 * Get dependencies for a specific task
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} Array of dependency objects
 */
export async function getDependencies(taskId) {
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
}

/**
 * Get tasks that depend on a specific task (blocking relationships)
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} Array of tasks that are blocked by this task
 */
export async function getBlockedTasks(taskId) {
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
}

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

// ========================================
// Mutation Functions
// ========================================

/**
 * Add a task dependency
 * @param {Object} dependency - { task_id, depends_on_task_id, dependency_type }
 * @returns {Promise<Object>} Created dependency
 */
export async function addDependency({ task_id, depends_on_task_id, dependency_type = 'finish_to_start' }) {
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
}

/**
 * Remove a task dependency
 * @param {number} taskId - Task ID
 * @param {number} dependsOnTaskId - Depends on task ID
 * @returns {Promise<void>}
 */
export async function removeDependency(taskId, dependsOnTaskId) {
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
}

/**
 * Update task dates (start_date and due_date)
 * @param {number} taskId - Task ID
 * @param {Object} dates - { start_date, due_date }
 * @returns {Promise<Object>} Updated task
 */
export async function updateTaskDates(taskId, { start_date, due_date }) {
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
}

// ========================================
// Scheduling Functions
// ========================================

/**
 * Calculate earliest start date for a task based on dependencies
 * @param {number} taskId - Task ID
 * @returns {Promise<Date|null>} Calculated start date or null if no dependencies
 */
export async function calculateTaskStartDate(taskId) {
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
 * @returns {Promise<Object>} { updated: count, tasks: updated_tasks }
 */
export async function autoScheduleTasks(projectId) {
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

/**
 * Validate that a task has required dates for Gantt display
 * @param {Object} task - Task object
 * @returns {boolean} True if task can be displayed on Gantt
 */
export function canDisplayOnGantt(task) {
  return !!(task.start_date && task.due_date);
}

/**
 * Get count of tasks missing dates
 * @param {Array} tasks - Array of tasks
 * @returns {number} Count of tasks without start_date or due_date
 */
export function getMissingDatesCount(tasks) {
  return tasks.filter(t => !canDisplayOnGantt(t)).length;
}

/**
 * Move task up in Gantt vertical order
 * @param {number} taskId - Task ID to move up
 * @param {number} projectId - Project ID (for filtering)
 * @returns {Promise<void>}
 */
export async function moveTaskUp(taskId, projectId) {
  try {
    // Get all tasks in order
    const filters = { project_id: projectId, sort_by: 'gantt_position' };
    const tasks = await getGanttTasks(filters);

    const currentIndex = tasks.findIndex(t => t.id === taskId);
    if (currentIndex <= 0) {
      return; // Already at top
    }

    // Swap positions with task above
    const currentTask = tasks[currentIndex];
    const aboveTask = tasks[currentIndex - 1];

    await supabase
      .from('tasks')
      .update({ gantt_position: aboveTask.gantt_position })
      .eq('id', currentTask.id);

    await supabase
      .from('tasks')
      .update({ gantt_position: currentTask.gantt_position })
      .eq('id', aboveTask.id);

  } catch (error) {
    console.error('Error moving task up:', error);
    throw error;
  }
}

/**
 * Move task down in Gantt vertical order
 * @param {number} taskId - Task ID to move down
 * @param {number} projectId - Project ID (for filtering)
 * @returns {Promise<void>}
 */
export async function moveTaskDown(taskId, projectId) {
  try {
    // Get all tasks in order
    const filters = { project_id: projectId, sort_by: 'gantt_position' };
    const tasks = await getGanttTasks(filters);

    const currentIndex = tasks.findIndex(t => t.id === taskId);
    if (currentIndex < 0 || currentIndex >= tasks.length - 1) {
      return; // Already at bottom or not found
    }

    // Swap positions with task below
    const currentTask = tasks[currentIndex];
    const belowTask = tasks[currentIndex + 1];

    await supabase
      .from('tasks')
      .update({ gantt_position: belowTask.gantt_position })
      .eq('id', currentTask.id);

    await supabase
      .from('tasks')
      .update({ gantt_position: currentTask.gantt_position })
      .eq('id', belowTask.id);

  } catch (error) {
    console.error('Error moving task down:', error);
    throw error;
  }
}

/**
 * Rebuild auto-dependencies for a project based on gantt_position order.
 * Creates a sequential finish-to-start chain: task[0] -> task[1] -> task[2] -> ...
 * Only touches auto-generated dependencies (is_auto = true), preserves manual ones.
 * @param {number} projectId - Project ID
 * @returns {Promise<{created: number}>}
 */
export async function rebuildAutoDependencies(projectId) {
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  // Get all tasks for the project sorted by gantt_position
  const tasks = await getGanttTasks({ project_id: projectId, sort_by: 'gantt_position' });

  // Only include tasks that have dates (visible on Gantt)
  const ganttTasks = tasks.filter(t => t.start_date && t.due_date);

  // Collect all task IDs in this project
  const taskIds = ganttTasks.map(t => t.id);

  if (taskIds.length === 0) return { created: 0 };

  // Step 1: Delete ALL existing auto-dependencies for these tasks
  // Delete where task_id is one of our tasks AND is_auto = true
  const { error: deleteError } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('is_auto', true)
    .in('task_id', taskIds);

  if (deleteError) {
    console.error('Delete auto-deps error:', deleteError);
    throw deleteError;
  }

  // Also delete auto-deps where depends_on_task_id is one of our tasks
  // (covers case where task was moved and old chain references it)
  const { error: deleteError2 } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('is_auto', true)
    .in('depends_on_task_id', taskIds);

  if (deleteError2) {
    console.error('Delete reverse auto-deps error:', deleteError2);
  }

  if (ganttTasks.length < 2) return { created: 0 };

  // Step 2: Build sequential dependency chain based on gantt_position order
  const companyId = ganttTasks[0].company_id || null;
  let createdCount = 0;

  for (let i = 1; i < ganttTasks.length; i++) {
    const dep = {
      task_id: ganttTasks[i].id,
      depends_on_task_id: ganttTasks[i - 1].id,
      dependency_type: 'finish_to_start',
      company_id: companyId,
      created_by: user.id,
      is_auto: true,
    };

    const { error: insertError } = await supabase
      .from('task_dependencies')
      .insert(dep);

    if (insertError) {
      // Skip unique constraint violations (manual dep already exists for this pair)
      if (insertError.code === '23505') {
        console.log(`Dependency ${ganttTasks[i-1].id} -> ${ganttTasks[i].id} already exists (manual), skipping`);
      } else {
        console.error(`Failed to create dependency ${ganttTasks[i-1].id} -> ${ganttTasks[i].id}:`, insertError);
      }
    } else {
      createdCount++;
    }
  }

  return { created: createdCount };
}

// ========================================
// Export all functions
// ========================================

export default {
  getGanttTasks,
  getDependencies,
  getBlockedTasks,
  getCriticalPath,
  addDependency,
  removeDependency,
  updateTaskDates,
  calculateTaskStartDate,
  autoScheduleTasks,
  canDisplayOnGantt,
  getMissingDatesCount,
  moveTaskUp,
  moveTaskDown,
  rebuildAutoDependencies,
};
