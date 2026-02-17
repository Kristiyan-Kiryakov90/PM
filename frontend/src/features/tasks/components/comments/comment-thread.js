/**
 * Comment Thread Component
 * Main orchestrator for threaded comments with replies and real-time updates
 */

import { commentService } from '@services/comment-service.js';
import { taskService } from "@services/task-service.js";
import { renderComments } from './comment-renderer.js';
import {
  handlePostComment,
  handleReplyComment,
  handleEditComment,
  handleDeleteComment,
  handleTextareaInput,
} from './comment-actions.js';

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
  const subscription = commentService.subscribeToComments(taskId, async (payload) => {
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
    const comments = await commentService.getComments(taskId);
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
 * Set up event listeners
 * @param {HTMLElement} container - Container element
 */
function setupEventListeners(container) {
  // Post comment
  container.addEventListener('click', async (e) => {
    const postBtn = e.target.closest('.post-comment-btn');
    if (postBtn) {
      e.preventDefault();
      await handlePostComment(container, loadComments);
    }

    // Reply to comment
    const replyBtn = e.target.closest('.reply-comment-btn');
    if (replyBtn) {
      e.preventDefault();
      const commentId = replyBtn.dataset.commentId;
      handleReplyComment(container, commentId, loadComments);
    }

    // Edit comment
    const editBtn = e.target.closest('.edit-comment-btn');
    if (editBtn) {
      e.preventDefault();
      const commentId = editBtn.dataset.commentId;
      handleEditComment(container, commentId, loadComments);
    }

    // Delete comment
    const deleteBtn = e.target.closest('.delete-comment-btn');
    if (deleteBtn) {
      e.preventDefault();
      const commentId = deleteBtn.dataset.commentId;
      await handleDeleteComment(container, commentId, loadComments);
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
