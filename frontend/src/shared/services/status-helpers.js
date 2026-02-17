/**
 * Status Helpers
 * Helper functions for categorizing tasks based on custom status definitions
 */

import supabase from './supabase.js';

/**
 * Get status definitions for given project IDs
 * @param {Array<number>} projectIds - Array of project IDs
 * @returns {Promise<Map>} Map of project_id-status_slug -> status definition
 */
export async function getStatusDefinitionsMap(projectIds) {
  if (!projectIds || projectIds.length === 0) {
    return new Map();
  }

  const { data: statusDefs, error } = await supabase
    .from('status_definitions')
    .select('project_id, slug, is_done, sort_order, name')
    .in('project_id', projectIds);

  if (error) {
    console.error('Error fetching status definitions:', error);
    return new Map();
  }

  // Build lookup map: "projectId-statusSlug" -> statusDef
  const map = new Map();
  statusDefs?.forEach(def => {
    const key = `${def.project_id}-${def.slug}`;
    map.set(key, def);
  });

  return map;
}

/**
 * Check if a task is completed based on its status definition
 * @param {Object} task - Task object with project_id and status
 * @param {Map} statusDefsMap - Status definitions map
 * @returns {boolean} True if task is in a "done" status
 */
export function isTaskCompleted(task, statusDefsMap) {
  if (!task.project_id || !task.status) {
    return false;
  }

  const key = `${task.project_id}-${task.status}`;
  const statusDef = statusDefsMap.get(key);

  // If no custom status definition found, fall back to hardcoded check
  if (!statusDef) {
    return task.status === 'done';
  }

  return statusDef.is_done === true;
}

/**
 * Categorize task status into standard buckets
 * @param {Object} task - Task object with project_id and status
 * @param {Map} statusDefsMap - Status definitions map
 * @returns {string} 'todo' | 'in_progress' | 'completed'
 */
export function categorizeTaskStatus(task, statusDefsMap) {
  if (!task.project_id || !task.status) {
    return 'in_progress';
  }

  const key = `${task.project_id}-${task.status}`;
  const statusDef = statusDefsMap.get(key);

  // If no custom status definition found, fall back to hardcoded categorization
  if (!statusDef) {
    if (task.status === 'done') return 'completed';
    if (task.status === 'todo') return 'todo';
    return 'in_progress';
  }

  // Use is_done flag and sort_order to categorize
  if (statusDef.is_done) {
    return 'completed';
  } else if (statusDef.sort_order === 0) {
    return 'todo';
  } else {
    return 'in_progress';
  }
}

/**
 * Get category label
 * @param {string} category - 'todo' | 'in_progress' | 'completed'
 * @returns {string} Human-readable label
 */
export function getCategoryLabel(category) {
  const labels = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'completed': 'Completed'
  };
  return labels[category] || category;
}
