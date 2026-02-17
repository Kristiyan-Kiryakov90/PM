/**
 * Gantt Dependencies Module
 * Handles task reordering and auto-dependency management
 */

import supabase from '../supabase.js';

/**
 * Move task up in Gantt vertical order
 * @param {number} taskId - Task ID to move up
 * @param {number} projectId - Project ID (for filtering)
 * @param {Function} getGanttTasks - Function to get Gantt tasks
 * @returns {Promise<void>}
 */
export async function moveTaskUp(taskId, projectId, getGanttTasks) {
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
 * @param {Function} getGanttTasks - Function to get Gantt tasks
 * @returns {Promise<void>}
 */
export async function moveTaskDown(taskId, projectId, getGanttTasks) {
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
 * @param {Function} getGanttTasks - Function to get Gantt tasks
 * @returns {Promise<{created: number}>}
 */
export async function rebuildAutoDependencies(projectId, getGanttTasks) {
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
