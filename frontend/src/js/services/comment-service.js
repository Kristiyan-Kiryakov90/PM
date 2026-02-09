/**
 * Comment Service
 * Handles comments and mentions CRUD operations with company isolation
 */

import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';
import { handleError } from '@utils/error-handler.js';

/**
 * Get all comments for a task
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} Array of comments with author info and mentions
 */
export async function getComments(taskId) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        id,
        task_id,
        parent_comment_id,
        author_id,
        content,
        is_action_item,
        action_assignee,
        action_resolved,
        action_resolved_at,
        edited_at,
        created_at,
        updated_at,
        mentions (
          id,
          mentioned_user_id
        )
      `
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Create a new comment
 * @param {Object} commentData - { task_id, content, parent_comment_id, is_action_item, action_assignee, mentions }
 * @returns {Promise<Object>} Created comment
 */
export async function createComment(commentData) {
  try {
    const {
      task_id,
      content,
      parent_comment_id = null,
      is_action_item = false,
      action_assignee = null,
      mentions = [],
    } = commentData;

    // Validation
    if (!task_id) {
      throw new Error('Task ID is required');
    }

    if (!content || content.trim() === '') {
      throw new Error('Comment content cannot be empty');
    }

    const companyId = await getUserCompanyId();
    const user = await supabase.auth.getUser();
    const userId = user.data?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Insert comment
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        company_id: companyId || null,
        task_id,
        parent_comment_id,
        author_id: userId,
        content: content.trim(),
        is_action_item,
        action_assignee: is_action_item ? action_assignee : null,
        action_resolved: false,
      })
      .select()
      .single();

    if (commentError) throw commentError;

    // Insert mentions if any
    if (mentions.length > 0 && comment) {
      const mentionRecords = mentions.map((userId) => ({
        comment_id: comment.id,
        mentioned_user_id: userId,
      }));

      const { error: mentionsError } = await supabase
        .from('mentions')
        .insert(mentionRecords);

      if (mentionsError) {
        console.error('Failed to create mentions:', mentionsError);
        // Don't throw - comment was created successfully
      }
    }

    return comment;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Update a comment
 * @param {number} commentId - Comment ID
 * @param {Object} updates - { content, is_action_item, action_assignee, action_resolved }
 * @returns {Promise<Object>} Updated comment
 */
export async function updateComment(commentId, updates) {
  try {
    const user = await supabase.auth.getUser();
    const userId = user.data?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const updateData = {
      edited_at: new Date().toISOString(),
    };

    if (updates.content !== undefined) {
      if (!updates.content || updates.content.trim() === '') {
        throw new Error('Comment content cannot be empty');
      }
      updateData.content = updates.content.trim();
    }

    if (updates.is_action_item !== undefined) {
      updateData.is_action_item = updates.is_action_item;
    }

    if (updates.action_assignee !== undefined) {
      updateData.action_assignee = updates.action_assignee;
    }

    if (updates.action_resolved !== undefined) {
      updateData.action_resolved = updates.action_resolved;
      if (updates.action_resolved) {
        updateData.action_resolved_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('comments')
      .update(updateData)
      .eq('id', commentId)
      .eq('author_id', userId) // Ensure user owns the comment
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Delete a comment
 * @param {number} commentId - Comment ID
 * @returns {Promise<void>}
 */
export async function deleteComment(commentId) {
  try {
    const user = await supabase.auth.getUser();
    const userId = user.data?.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('author_id', userId); // Ensure user owns the comment

    if (error) throw error;
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Resolve an action item comment
 * @param {number} commentId - Comment ID
 * @returns {Promise<Object>} Updated comment
 */
export async function resolveActionItem(commentId) {
  return updateComment(commentId, {
    action_resolved: true,
  });
}

/**
 * Unresolve an action item comment
 * @param {number} commentId - Comment ID
 * @returns {Promise<Object>} Updated comment
 */
export async function unresolveActionItem(commentId) {
  return updateComment(commentId, {
    action_resolved: false,
    action_resolved_at: null,
  });
}

/**
 * Get comment thread (recursive)
 * @param {number} rootCommentId - Root comment ID
 * @returns {Promise<Array>} Threaded comments
 */
export async function getCommentThread(rootCommentId) {
  try {
    const { data, error } = await supabase.rpc('get_comment_thread', {
      root_comment_id: rootCommentId,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    handleError(error, { showAlert: false, logError: true });
    throw error;
  }
}

/**
 * Parse @mentions from comment content
 * @param {string} content - Comment text
 * @param {Array} companyUsers - Available users to mention
 * @returns {Array<string>} Array of mentioned user IDs
 */
export function parseMentions(content, companyUsers = []) {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  const mentionedUserIds = [];

  for (const match of matches) {
    const username = match[1].toLowerCase();
    // Find user by email or name
    const user = companyUsers.find(
      (u) =>
        u.email?.toLowerCase().includes(username) ||
        u.name?.toLowerCase().includes(username)
    );

    if (user && !mentionedUserIds.includes(user.id)) {
      mentionedUserIds.push(user.id);
    }
  }

  return mentionedUserIds;
}

/**
 * Subscribe to real-time comments for a task
 * @param {number} taskId - Task ID
 * @param {Function} callback - Callback(payload)
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToComments(taskId, callback) {
  const channel = supabase
    .channel(`comments:task_id=eq.${taskId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
