/**
 * Status Helpers
 * Helper functions for categorizing tasks based on custom status definitions
 */

import supabase from './supabase.js';

// 30-second cache + in-flight deduplication for status definitions.
// All concurrent callers (e.g. the 5 dashboard functions) share one request.
let _statusDefsCache = null;
let _statusDefsCacheTime = 0;
let _statusDefsInflight = null;
const STATUS_DEFS_TTL = 30_000;

/**
 * Get status definitions for given project IDs.
 * Fetches all definitions visible to the current user (RLS-scoped to company)
 * so concurrent callers on the same page share a single request + cached result.
 * @param {Array<number>} projectIds - kept for API compatibility; RLS scopes result
 * @returns {Promise<Map>} Map of "project_id-status_slug" -> status definition
 */
export async function getStatusDefinitionsMap(projectIds) {
  if (!projectIds || projectIds.length === 0) {
    return new Map();
  }

  // 1. Return cached map if still fresh
  if (_statusDefsCache && (Date.now() - _statusDefsCacheTime) < STATUS_DEFS_TTL) {
    return _statusDefsCache;
  }

  // 2. Deduplicate concurrent calls — all waiters share the same in-flight promise
  if (!_statusDefsInflight) {
    _statusDefsInflight = supabase
      .from('status_definitions')
      .select('project_id, slug, is_done, sort_order, name')
      .then(({ data: statusDefs, error }) => {
        _statusDefsInflight = null;
        if (error) {
          console.error('Error fetching status definitions:', error);
          return new Map();
        }
        const map = new Map();
        (statusDefs || []).forEach(def => {
          map.set(`${def.project_id}-${def.slug}`, def);
        });
        _statusDefsCache = map;
        _statusDefsCacheTime = Date.now();
        return map;
      });
  }

  return _statusDefsInflight;
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
