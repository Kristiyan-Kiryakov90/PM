/**
 * Comment Thread Component
 * Renders threaded comments with replies, action items, and real-time updates
 */

import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  resolveActionItem,
  unresolveActionItem,
  subscribeToComments,
} from '@services/comment-service.js';
import { taskService } from "../services/task-service.js"';
import {
  getTaskChecklists,
  createChecklist,
  createChecklistItem,
  updateChecklistItem,
} from '@services/checklist-service.js';

/**
 * Initialize comment thread for a task
 * @param {number} taskId - Task ID
 * @param {HTMLElement} container - Container element
 */
export async function initCommentThread(taskId, container) {
  if (!container) return;

  container.dataset.taskId = taskId;

  // Load initial comments
  await loadComments(taskId, container);

  // Set up event listeners
  setupEventListeners(container);

  // Subscribe to real-time updates
  const subscription = subscribeToComments(taskId, async (payload) => {
    await loadComments(taskId, container);
  });

  // Store subscription for cleanup
  container.dataset.subscription = subscription;
}

/**
 * Load and render comments
 * @param {number} taskId - Task ID
 * @param {HTMLElement} container - Container element
 */
async function loadComments(taskId, container) {
  try {
    const comments = await getComments(taskId);
    const companyUsers = await taskService.getCompanyUsers();

    renderComments(comments, companyUsers, container);
  } catch (error) {
    console.error('Failed to load comments:', error);
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Failed to load comments. Please try again.
      </div>
    `;
  }
}

/**
 * Render comments as nested thread
 * @param {Array} comments - Comments array
 * @param {Array} companyUsers - Company users for mentions
 * @param {HTMLElement} container - Container element
 */
function renderComments(comments, companyUsers, container) {
  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const commentMap = new Map();

  // Build comment map
  comments.forEach((comment) => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  });

  // Build tree structure
  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(commentMap.get(comment.id));
      }
    }
  });

  // Render
  const html = `
    <div class="comment-thread">
      <div class="comment-list">
        ${rootComments.map((c) => renderComment(commentMap.get(c.id), companyUsers, 0)).join('')}
        ${rootComments.length === 0 ? '<div class="text-center text-muted py-4"><i class="bi bi-chat-dots me-2"></i>No comments yet. Be the first to comment!</div>' : ''}
      </div>

      <div class="comment-form mt-3">
        <textarea
          class="form-control comment-input"
          rows="3"
          placeholder="Write a comment... (use @name to mention)"
        ></textarea>
        <div class="d-flex justify-content-between align-items-center mt-2">
          <small class="text-muted comment-char-count">
            <span class="current-chars">0</span> characters
          </small>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary post-comment-btn" disabled>Post Comment</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Render a single comment with replies
 * @param {Object} comment - Comment object
 * @param {Array} companyUsers - Company users
 * @param {number} depth - Nesting depth
 * @returns {string} HTML
 */
function renderComment(comment, companyUsers, depth = 0) {
  const indentClass = depth > 0 ? 'ms-4' : '';

  const editedBadge = comment.edited_at
    ? `<span class="text-muted small">(edited)</span>`
    : '';

  const mentions = comment.mentions || [];
  const mentionBadges = mentions
    .map(
      (m) =>
        `<span class="badge bg-info text-dark ms-1">@${m.mentioned_user_id}</span>`
    )
    .join('');

  return `
    <div class="comment-item ${indentClass} mb-2" data-comment-id="${comment.id}">
      <div class="comment-card card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div>
              <strong class="comment-author">${comment.author_id.substring(0, 8)}</strong>
              ${mentionBadges}
              <span class="text-muted small ms-2">${formatDate(comment.created_at)}</span>
              ${editedBadge}
            </div>
            <div class="dropdown">
              <button class="btn btn-sm btn-link text-muted dropdown-toggle"
                      type="button"
                      data-bs-toggle="dropdown">
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu">
                <li><a class="dropdown-item reply-comment-btn" href="#" data-comment-id="${comment.id}">
                  <i class="bi bi-reply"></i> Reply
                </a></li>
                <li><a class="dropdown-item edit-comment-btn" href="#" data-comment-id="${comment.id}">
                  <i class="bi bi-pencil"></i> Edit
                </a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger delete-comment-btn" href="#" data-comment-id="${comment.id}">
                  <i class="bi bi-trash"></i> Delete
                </a></li>
              </ul>
            </div>
          </div>

          <div class="comment-content">
            ${escapeHtml(comment.content)}
          </div>
        </div>
      </div>

      ${comment.replies && comment.replies.length > 0 ? `
        <div class="comment-replies mt-2">
          ${comment.replies.map((r) => renderComment(r, companyUsers, depth + 1)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Set up event listeners
 * @param {HTMLElement} container - Container element
 */
function setupEventListeners(container) {
  // Post comment
  container.addEventListener('click', async (e) => {
    const postBtn = e.target.closest('.post-comment-btn');
    if (postBtn) {
      e.preventDefault();
      await handlePostComment(container);
    }

    // Reply to comment
    const replyBtn = e.target.closest('.reply-comment-btn');
    if (replyBtn) {
      e.preventDefault();
      const commentId = replyBtn.dataset.commentId;
      handleReplyComment(container, commentId);
    }

    // Edit comment
    const editBtn = e.target.closest('.edit-comment-btn');
    if (editBtn) {
      e.preventDefault();
      const commentId = editBtn.dataset.commentId;
      handleEditComment(container, commentId);
    }

    // Delete comment
    const deleteBtn = e.target.closest('.delete-comment-btn');
    if (deleteBtn) {
      e.preventDefault();
      const commentId = deleteBtn.dataset.commentId;
      await handleDeleteComment(container, commentId);
    }
  });

  // Handle textarea input for dynamic button state
  container.addEventListener('input', (e) => {
    const textarea = e.target.closest('.comment-input');
    if (textarea) {
      handleTextareaInput(container, textarea);
    }
  });

  // Initialize button state
  setTimeout(() => {
    const textarea = container.querySelector('.comment-input');
    const postBtn = container.querySelector('.post-comment-btn');
    if (textarea && postBtn) {
      postBtn.disabled = !textarea.value.trim();
    }
  }, 0);
}

/**
 * Handle textarea input to update button state
 * @param {HTMLElement} container - Container element
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function handleTextareaInput(container, textarea) {
  const postBtn = container.querySelector('.post-comment-btn');
  const charCount = container.querySelector('.current-chars');

  const content = textarea.value.trim();
  const charLength = textarea.value.length;
  const hasContent = content.length > 0;

  // Enable/disable button based on content
  if (postBtn) {
    postBtn.disabled = !hasContent;
  }

  // Update character count
  if (charCount) {
    charCount.textContent = charLength;
    const countContainer = container.querySelector('.comment-char-count');
    if (countContainer) {
      countContainer.style.opacity = charLength > 0 ? '1' : '0.5';
    }
  }

  // Auto-resize textarea based on content
  textarea.style.height = 'auto';
  const newHeight = Math.max(80, Math.min(textarea.scrollHeight, 200));
  textarea.style.height = newHeight + 'px';
}

/**
 * Handle post comment
 * @param {HTMLElement} container - Container element
 */
async function handlePostComment(container) {
  const taskId = parseInt(container.dataset.taskId);
  const input = container.querySelector('.comment-input');
  const postBtn = container.querySelector('.post-comment-btn');
  const content = input.value.trim();

  if (!content) return;

  // Disable button during submission
  if (postBtn) {
    postBtn.disabled = true;
    postBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Posting...';
  }

  try {
    await createComment({
      task_id: taskId,
      content,
      is_action_item: false,
    });

    // Clear form
    input.value = '';
    input.style.height = 'auto';

    // Reload comments
    await loadComments(taskId, container);
  } catch (error) {
    console.error('Failed to post comment:', error);
    alert('Failed to post comment. Please try again.');

    // Re-enable button on error
    if (postBtn) {
      postBtn.disabled = false;
      postBtn.textContent = 'Post Comment';
    }
  }
}

/**
 * Handle reply to comment
 * @param {HTMLElement} container - Container element
 * @param {number} commentId - Parent comment ID
 */
function handleReplyComment(container, commentId) {
  const taskId = parseInt(container.dataset.taskId);

  // Find the comment item
  const commentItem = container.querySelector(`[data-comment-id="${commentId}"]`);
  if (!commentItem) return;

  // Check if reply form already exists
  if (commentItem.querySelector('.reply-form')) return;

  // Create reply form
  const replyForm = document.createElement('div');
  replyForm.className = 'reply-form mt-2 ms-4';
  replyForm.innerHTML = `
    <textarea
      class="form-control reply-input"
      rows="2"
      placeholder="Write a reply..."
    ></textarea>
    <div class="d-flex justify-content-end gap-2 mt-2">
      <button class="btn btn-sm btn-secondary cancel-reply-btn">Cancel</button>
      <button class="btn btn-sm btn-primary post-reply-btn">Reply</button>
    </div>
  `;

  // Insert after comment card
  const commentCard = commentItem.querySelector('.comment-card');
  commentCard.after(replyForm);

  // Focus the textarea
  const textarea = replyForm.querySelector('.reply-input');
  textarea.focus();

  // Handle cancel
  replyForm.querySelector('.cancel-reply-btn').addEventListener('click', () => {
    replyForm.remove();
  });

  // Handle post reply
  replyForm.querySelector('.post-reply-btn').addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) return;

    try {
      await createComment({
        task_id: taskId,
        content,
        parent_comment_id: commentId,
      });

      // Reload comments
      await loadComments(taskId, container);
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('Failed to post reply. Please try again.');
    }
  });
}

/**
 * Handle edit comment
 * @param {HTMLElement} container - Container element
 * @param {number} commentId - Comment ID
 */
async function handleEditComment(container, commentId) {
  const taskId = parseInt(container.dataset.taskId);

  // Find the comment item
  const commentItem = container.querySelector(`[data-comment-id="${commentId}"]`);
  if (!commentItem) return;

  const commentContent = commentItem.querySelector('.comment-content');
  if (!commentContent) return;

  // Get current content
  const currentContent = commentContent.textContent.trim();

  // Check if already in edit mode
  if (commentItem.querySelector('.edit-form')) return;

  // Replace content with edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-form';
  editForm.innerHTML = `
    <textarea
      class="form-control edit-input"
      rows="3"
    >${escapeHtml(currentContent)}</textarea>
    <div class="d-flex justify-content-end gap-2 mt-2">
      <button class="btn btn-sm btn-secondary cancel-edit-btn">Cancel</button>
      <button class="btn btn-sm btn-primary save-edit-btn">Save</button>
    </div>
  `;

  // Replace comment content with edit form
  commentContent.replaceWith(editForm);

  // Focus the textarea
  const textarea = editForm.querySelector('.edit-input');
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  // Handle cancel
  editForm.querySelector('.cancel-edit-btn').addEventListener('click', () => {
    // Reload comments to restore original content
    loadComments(taskId, container);
  });

  // Handle save
  editForm.querySelector('.save-edit-btn').addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent) {
      alert('Comment cannot be empty');
      return;
    }

    if (newContent === currentContent) {
      // No changes, just restore
      await loadComments(taskId, container);
      return;
    }

    try {
      await updateComment(commentId, { content: newContent });

      // Reload comments
      await loadComments(taskId, container);
    } catch (error) {
      console.error('Failed to update comment:', error);
      alert('Failed to update comment. Please try again.');
    }
  });
}

/**
 * Handle delete comment
 * @param {HTMLElement} container - Container element
 * @param {number} commentId - Comment ID
 */
async function handleDeleteComment(container, commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  try {
    await deleteComment(commentId);
    await loadComments(parseInt(container.dataset.taskId), container);
  } catch (error) {
    console.error('Failed to delete comment:', error);
    alert('Failed to delete comment. Please try again.');
  }
}

/**
 * Handle convert comment to action item
 * @param {HTMLElement} container - Container element
 * @param {number} commentId - Comment ID
 */
async function handleConvertToActionItem(container, commentId) {
  if (!confirm('Convert this comment to an action item? This will add it as a checklist item.')) {
    return;
  }

  const taskId = parseInt(container.dataset.taskId);

  try {
    // Update comment to mark as action item
    await updateComment(commentId, { is_action_item: true });

    // Get the comment to extract its content
    const comments = await getComments(taskId);
    const comment = comments.find((c) => c.id === commentId);

    if (comment) {
      // Create corresponding checklist item
      await createActionItemChecklistItem(taskId, commentId, comment.content);
      // Trigger modal refresh to show new checklist item
      await refreshTaskModal(taskId);
    }

    // Reload comments
    await loadComments(taskId, container);
  } catch (error) {
    console.error('Failed to convert to action item:', error);
    alert('Failed to convert to action item. Please try again.');
  }
}

// Removed: handleCreateChecklistItemForActionItem - no longer needed
// Removed: handleToggleActionResolved - completion tracked in checklist only

/**
 * Get or create the "Action Items" checklist
 * @param {number} taskId - Task ID
 * @returns {Promise<Object>} Checklist object
 */
async function getOrCreateActionItemsChecklist(taskId) {
  try {
    const checklists = await getTaskChecklists(taskId);

    // Look for existing "Action Items" checklist
    let actionItemsChecklist = checklists.find((c) => c.title === 'Action Items');

    // Create if doesn't exist
    if (!actionItemsChecklist) {
      actionItemsChecklist = await createChecklist({
        task_id: taskId,
        title: 'Action Items',
      });
    }

    return actionItemsChecklist;
  } catch (error) {
    console.error('Failed to get/create action items checklist:', error);
    throw error;
  }
}

/**
 * Create a checklist item for an action item comment
 * @param {number} taskId - Task ID
 * @param {number} commentId - Comment ID
 * @param {string} content - Comment content
 */
async function createActionItemChecklistItem(taskId, commentId, content) {
  try {
    console.log('🔧 Creating checklist item for action item:', { taskId, commentId, content });

    const checklist = await getOrCreateActionItemsChecklist(taskId);
    console.log('📋 Got/created checklist:', checklist);

    // Create checklist item with comment ID in metadata (if your schema supports it)
    // For now, we'll use the content field to link them
    const itemContent = `${content} (from comment)`;

    const item = await createChecklistItem({
      checklist_id: checklist.id,
      content: itemContent,
      is_completed: false,
    });

    console.log('✅ Created checklist item:', item);
  } catch (error) {
    console.error('❌ Failed to create action item checklist item:', error);
    // Don't throw - comment was created successfully
  }
}

// Removed: syncChecklistItemWithActionItem - checklist is source of truth, no sync needed

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) return 'just now';

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Default
  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Refresh the task modal to update checklists
 * @param {number} taskId - Task ID
 */
async function refreshTaskModal(taskId) {
  try {
    console.log('🔄 Refreshing task modal for task:', taskId);
    // Close and reopen the modal to refresh all data including checklists
    // This is a workaround - ideally we'd have a more elegant refresh mechanism
    if (typeof window.openViewModal === 'function') {
      // Give a delay to let the checklist item be created in the database
      setTimeout(() => {
        console.log('🔄 Reopening modal...');
        window.openViewModal(taskId);
      }, 800);
    } else {
      console.error('❌ window.openViewModal is not a function');
    }
  } catch (error) {
    console.error('❌ Failed to refresh task modal:', error);
    // Don't throw - comment was created successfully
  }
}

/**
 * Cleanup subscription when component is destroyed
 * @param {HTMLElement} container - Container element
 */
export function destroyCommentThread(container) {
  const subscription = container.dataset.subscription;
  if (subscription) {
    subscription.unsubscribe();
    delete container.dataset.subscription;
  }
}
