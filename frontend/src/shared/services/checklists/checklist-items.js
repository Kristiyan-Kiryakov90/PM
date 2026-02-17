/**
 * Checklist Item Operations
 * CRUD and actions for checklist items
 */

import supabase from '../supabase.js';
import { errorHandler } from '@utils/error-handler.js';

/**
 * Create a checklist item
 * @param {Object} itemData - { checklist_id, content, sort_order, assigned_to, due_date }
 * @returns {Promise<Object>} Created item
 */
export async function createChecklistItem(itemData) {
  try {
    const {
      checklist_id,
      content,
      sort_order = 0,
      assigned_to = null,
      due_date = null,
    } = itemData;

    // Validation
    if (!checklist_id) {
      throw new Error('Checklist ID is required');
    }
    if (!content || content.trim() === '') {
      throw new Error('Item content is required');
    }
    if (content.length > 500) {
      throw new Error('Item content must be 500 characters or less');
    }

    const { data, error } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id,
        content: content.trim(),
        sort_order,
        assigned_to,
        due_date,
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
 * Update a checklist item
 * @param {number} itemId - Item ID
 * @param {Object} updates - { content, is_completed, sort_order, assigned_to, due_date }
 * @returns {Promise<Object>} Updated item
 */
export async function updateChecklistItem(itemId, updates) {
  try {
    const updateData = {};

    if (updates.content !== undefined) {
      if (!updates.content || updates.content.trim() === '') {
        throw new Error('Item content cannot be empty');
      }
      if (updates.content.length > 500) {
        throw new Error('Item content must be 500 characters or less');
      }
      updateData.content = updates.content.trim();
    }

    if (updates.is_completed !== undefined) {
      updateData.is_completed = updates.is_completed;
      // completed_at and completed_by are auto-set by trigger
    }

    if (updates.sort_order !== undefined) {
      updateData.sort_order = updates.sort_order;
    }

    if (updates.assigned_to !== undefined) {
      updateData.assigned_to = updates.assigned_to;
    }

    if (updates.due_date !== undefined) {
      updateData.due_date = updates.due_date;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('Failed to update checklist item');
    }

    return data;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Toggle a checklist item's completed status
 * @param {number} itemId - Item ID
 * @returns {Promise<Object>} Updated item
 */
export async function toggleChecklistItem(itemId) {
  try {
    // Get current state
    const { data: currentItem, error: fetchError } = await supabase
      .from('checklist_items')
      .select('is_completed')
      .eq('id', itemId)
      .single();

    if (fetchError) throw fetchError;

    // Toggle it
    return await updateChecklistItem(itemId, {
      is_completed: !currentItem.is_completed,
    });
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Delete a checklist item
 * @param {number} itemId - Item ID
 * @returns {Promise<void>}
 */
export async function deleteChecklistItem(itemId) {
  try {
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Reorder checklist items
 * @param {number} checklistId - Checklist ID
 * @param {Array<{id: number, sort_order: number}>} itemOrders - Array of item IDs with new sort orders
 * @returns {Promise<void>}
 */
export async function reorderChecklistItems(checklistId, itemOrders) {
  try {
    const updates = itemOrders.map(({ id, sort_order }) =>
      supabase
        .from('checklist_items')
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('checklist_id', checklistId)
    );

    const results = await Promise.all(updates);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      throw new Error('Failed to reorder some items');
    }
  } catch (error) {
    errorHandler.handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}
