/**
 * Tag Service
 * Manages tags and task-tag relationships
 * Phase 3B: Tags/Labels
 */

import supabase from './supabase.js';
import { authUtils } from '../utils/auth.js';

/**
 * Get all tags for the current user's company
 * @returns {Promise<Array>} List of tags
 */
export const tagService = {
  async getTags() {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single tag by ID
   * @param {number} tagId - Tag ID
   * @returns {Promise<Object>} Tag
   */
  async getTag(tagId) {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('id', tagId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new tag
   * @param {Object} tagData - { name, color }
   * @returns {Promise<Object>} Created tag
   */
  async createTag(tagData) {
    const user = await authUtils.getCurrentUser();

    const { data, error} = await supabase
      .from('tags')
      .insert({
        name: tagData.name.trim(),
        color: tagData.color || '#6b7280',
        company_id: user.user_metadata?.company_id || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`Tag "${tagData.name}" already exists`);
      }
      throw error;
    }

    return data;
  },

  /**
   * Update a tag
   * @param {number} tagId - Tag ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated tag
   */
  async updateTag(tagId, updates) {
    const { data, error } = await supabase
      .from('tags')
      .update(updates)
      .eq('id', tagId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Tag "${updates.name}" already exists`);
      }
      throw error;
    }

    return data;
  },

  /**
   * Delete a tag
   * @param {number} tagId - Tag ID
   * @returns {Promise<void>}
   */
  async deleteTag(tagId) {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;
  },

  /**
   * Add a tag to a task
   * @param {number} taskId - Task ID
   * @param {number} tagId - Tag ID
   * @returns {Promise<void>}
   */
  async addTagToTask(taskId, tagId) {
    const { error } = await supabase
      .from('task_tags')
      .insert({
        task_id: taskId,
        tag_id: tagId,
      });

    if (error) {
      // Handle duplicate (tag already on task)
      if (error.code === '23505') {
        return; // Silently ignore - tag already added
      }
      throw error;
    }
  },

  /**
   * Remove a tag from a task
   * @param {number} taskId - Task ID
   * @param {number} tagId - Tag ID
   * @returns {Promise<void>}
   */
  async removeTagFromTask(taskId, tagId) {
    const { error } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .eq('tag_id', tagId);

    if (error) throw error;
  },

  /**
   * Get all tags for a task
   * @param {number} taskId - Task ID
   * @returns {Promise<Array>} List of tags
   */
  async getTaskTags(taskId) {
    const { data, error } = await supabase
      .from('task_tags')
      .select('tag_id, tags(*)')
      .eq('task_id', taskId);

    if (error) throw error;

    // Extract the tags from the nested structure
    return (data || []).map(item => item.tags);
  },

  /**
   * Get tasks with a specific tag
   * @param {number} tagId - Tag ID
   * @returns {Promise<Array>} List of tasks
   */
  async getTasksByTag(tagId) {
    const { data, error } = await supabase
      .from('task_tags')
      .select('task_id, tasks(*)')
      .eq('tag_id', tagId);

    if (error) throw error;

    // Extract the tasks from the nested structure
    return (data || []).map(item => item.tasks);
  },

  /**
   * Set all tags for a task (replaces existing tags)
   * OPTIMIZED: Uses batch operations instead of N+1 queries
   * @param {number} taskId - Task ID
   * @param {Array<number>} tagIds - Array of tag IDs
   * @returns {Promise<void>}
   */
  async setTaskTags(taskId, tagIds) {
    // Get existing tags to determine what to add/remove
    const existingTags = await this.getTaskTags(taskId);
    const existingTagIds = existingTags.map(t => t.id);

    // Determine what to add and remove
    const toAdd = tagIds.filter(id => !existingTagIds.includes(id));
    const toRemove = existingTagIds.filter(id => !tagIds.includes(id));

    // BATCH DELETE: Remove tags in single query with IN clause
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .in('tag_id', toRemove);

      if (error) throw error;
    }

    // BATCH INSERT: Add new tags in single query
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('task_tags')
        .insert(toAdd.map(tagId => ({ task_id: taskId, tag_id: tagId })));

      if (error) {
        // Handle duplicate (tag already on task) - shouldn't happen but be safe
        if (error.code !== '23505') {
          throw error;
        }
      }
    }
  },

  /**
   * Search tags by name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching tags
   */
  async searchTags(query) {
    if (!query || query.trim() === '') {
      return this.getTags();
    }

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get tag usage statistics
   * @param {number} tagId - Tag ID
   * @returns {Promise<Object>} { tagId, usageCount, taskIds }
   */
  async getTagUsage(tagId) {
    const { data, error } = await supabase
      .from('task_tags')
      .select('task_id')
      .eq('tag_id', tagId);

    if (error) throw error;

    return {
      tagId,
      usageCount: data?.length || 0,
      taskIds: (data || []).map(item => item.task_id),
    };
  },

  /**
   * Get all tags with usage counts
   * OPTIMIZED: Uses database RPC function instead of N+1 queries
   * @returns {Promise<Array>} Tags with usage counts
   */
  async getTagsWithUsage() {
    // Use RPC function that performs LEFT JOIN + GROUP BY in single query
    // Prevents N+1 issue: 1 query instead of 1 + N queries for N tags
    const { data, error } = await supabase.rpc('get_tags_with_usage');

    if (error) throw error;

    // Map usage_count to usageCount for consistency with existing code
    return (data || []).map(tag => ({
      ...tag,
      usageCount: tag.usage_count,
    }));
  },

  /**
   * Predefined tag colors
   */
  TAG_COLORS: [
    { name: 'Gray', value: '#6b7280' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
  ],

  /**
   * Get a contrasting text color for a background color
   * @param {string} hexColor - Hex color code
   * @returns {string} '#000000' or '#ffffff'
   */
  getContrastColor(hexColor) {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white depending on luminance
    return luminance > 0.5 ? '#000000' : '#ffffff';
  },

  /**
   * Subscribe to tag changes
   * @param {Function} callback - Called when tags change
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeToTags(callback) {
    const subscription = supabase
      .channel('tags_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags',
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      },
    };
  },

  /**
   * Subscribe to task-tag relationship changes for a task
   * @param {number} taskId - Task ID
   * @param {Function} callback - Called when task tags change
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeToTaskTags(taskId, callback) {
    const subscription = supabase
      .channel(`task_tags:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_tags',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      },
    };
  }

};
