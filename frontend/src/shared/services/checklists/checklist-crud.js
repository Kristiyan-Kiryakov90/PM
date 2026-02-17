/**
 * Checklist CRUD Operations
 * Create, read, update, delete for checklists
 */

import supabase from '../supabase.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Get all checklists for a task
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} Array of checklists with items
 */
export async function getTaskChecklists(taskId) {
  try {
    const { data, error } = await supabase
      .from('checklists')
      .select(`
        *,
        checklist_items (
          *
        )
      `)
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Sort items within each checklist
    const checklists = (data || []).map(checklist => ({
      ...checklist,
      checklist_items: (checklist.checklist_items || []).sort((a, b) => a.sort_order - b.sort_order),
    }));

    return checklists;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Get a single checklist
 * @param {number} checklistId - Checklist ID
 * @returns {Promise<Object>} Checklist with items
 */
export async function getChecklist(checklistId) {
  try {
    const { data, error } = await supabase
      .from('checklists')
      .select(`
        *,
        checklist_items (
          *
        )
      `)
      .eq('id', checklistId)
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Checklist not found');
    }

    // Sort items
    data.checklist_items = (data.checklist_items || []).sort((a, b) => a.sort_order - b.sort_order);

    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Create a new checklist for a task
 * @param {Object} checklistData - { task_id, title, sort_order }
 * @returns {Promise<Object>} Created checklist
 */
export async function createChecklist(checklistData) {
  try {
    const { task_id, title, sort_order = 0 } = checklistData;

    // Validation
    if (!task_id) {
      throw new Error('Task ID is required');
    }
    if (!title || title.trim() === '') {
      throw new Error('Checklist title is required');
    }
    if (title.length > 100) {
      throw new Error('Checklist title must be 100 characters or less');
    }

    const { data, error } = await supabase
      .from('checklists')
      .insert({
        task_id,
        title: title.trim(),
        sort_order,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Update a checklist
 * @param {number} checklistId - Checklist ID
 * @param {Object} updates - { title, sort_order }
 * @returns {Promise<Object>} Updated checklist
 */
export async function updateChecklist(checklistId, updates) {
  try {
    const updateData = {};

    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim() === '') {
        throw new Error('Checklist title cannot be empty');
      }
      if (updates.title.length > 100) {
        throw new Error('Checklist title must be 100 characters or less');
      }
      updateData.title = updates.title.trim();
    }

    if (updates.sort_order !== undefined) {
      updateData.sort_order = updates.sort_order;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('checklists')
      .update(updateData)
      .eq('id', checklistId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Failed to update checklist');
    }

    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Delete a checklist (and all its items)
 * @param {number} checklistId - Checklist ID
 * @returns {Promise<void>}
 */
export async function deleteChecklist(checklistId) {
  try {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', checklistId);

    if (error) throw error;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Get checklist progress (completed vs total items)
 * @param {number} checklistId - Checklist ID
 * @returns {Promise<{completed: number, total: number, percentage: number}>} Progress stats
 */
export async function getChecklistProgress(checklistId) {
  try {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('is_completed')
      .eq('checklist_id', checklistId);

    if (error) throw error;

    const total = data.length;
    const completed = data.filter(item => item.is_completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Get all checklists progress for a task
 * @param {number} taskId - Task ID
 * @returns {Promise<{completed: number, total: number, percentage: number}>} Overall progress
 */
export async function getTaskChecklistsProgress(taskId) {
  try {
    // Get all items for all checklists in this task
    const { data, error } = await supabase
      .from('checklist_items')
      .select('is_completed')
      .in('checklist_id',
        supabase
          .from('checklists')
          .select('id')
          .eq('task_id', taskId)
      );

    if (error) throw error;

    const total = data.length;
    const completed = data.filter(item => item.is_completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}
