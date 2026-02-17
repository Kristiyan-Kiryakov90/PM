/**
 * Comment Thread Component
 * Main orchestrator for threaded comments with replies and real-time updates
 */

import { commentService } from '@services/comment-service.js';
import { teamService } from '@services/team-service.js';
import { authUtils } from '@utils/auth.js';
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
    const [comments, teamMembers, currentUser] = await Promise.all([
      commentService.getComments(taskId),
      teamService.getTeamMembers(),
      authUtils.getCurrentUser(),
    ]);

    // Store team members on container for mention autocomplete
    container._companyUsers = teamMembers;

    renderComments(comments, teamMembers, container, currentUser?.id);
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
  // Close all open comment menus
  function closeAllMenus() {
    container.querySelectorAll('.comment-menu-wrapper.open').forEach(w => w.classList.remove('open'));
  }

  container.addEventListener('click', async (e) => {
    // Toggle comment action menu
    const menuToggle = e.target.closest('.comment-menu-toggle');
    if (menuToggle) {
      e.preventDefault();
      const wrapper = menuToggle.closest('.comment-menu-wrapper');
      const isOpen = wrapper.classList.contains('open');
      closeAllMenus();
      if (!isOpen) {
        wrapper.classList.add('open');
        // Position dropdown with fixed coordinates to escape overflow clipping
        const dropdown = wrapper.querySelector('.comment-menu-dropdown');
        if (dropdown) {
          const btnRect = menuToggle.getBoundingClientRect();
          const dropdownHeight = dropdown.offsetHeight || 120;
          const spaceBelow = window.innerHeight - btnRect.bottom;
          if (spaceBelow < dropdownHeight + 8) {
            // Open upward
            dropdown.style.top = (btnRect.top - dropdownHeight - 2) + 'px';
          } else {
            // Open downward
            dropdown.style.top = (btnRect.bottom + 2) + 'px';
          }
          dropdown.style.left = (btnRect.right - dropdown.offsetWidth || btnRect.right - 130) + 'px';
          // Recalculate left after offsetWidth is known
          requestAnimationFrame(() => {
            dropdown.style.left = (btnRect.right - dropdown.offsetWidth) + 'px';
          });
        }
      }
      return;
    }

    // Close menus when clicking outside
    if (!e.target.closest('.comment-menu-wrapper')) {
      closeAllMenus();
    }

    // Post comment
    const postBtn = e.target.closest('.post-comment-btn');
    if (postBtn) {
      e.preventDefault();
      await handlePostComment(container, loadComments);
    }

    // Reply to comment
    const replyBtn = e.target.closest('.reply-comment-btn');
    if (replyBtn) {
      e.preventDefault();
      closeAllMenus();
      const commentId = replyBtn.dataset.commentId;
      handleReplyComment(container, commentId, loadComments);
    }

    // Edit comment
    const editBtn = e.target.closest('.edit-comment-btn');
    if (editBtn) {
      e.preventDefault();
      closeAllMenus();
      const commentId = editBtn.dataset.commentId;
      handleEditComment(container, commentId, loadComments);
    }

    // Delete comment
    const deleteBtn = e.target.closest('.delete-comment-btn');
    if (deleteBtn) {
      e.preventDefault();
      closeAllMenus();
      const commentId = deleteBtn.dataset.commentId;
      await handleDeleteComment(container, commentId, loadComments);
    }
  });

  // Close dropdown when the comment list is scrolled (capture phase catches non-bubbling scroll events)
  container.addEventListener('scroll', closeAllMenus, { capture: true, passive: true });

  // Close dropdown when clicking outside the container entirely (e.g. modal backdrop)
  function handleDocumentClick(e) {
    if (!container.contains(e.target)) {
      closeAllMenus();
    }
  }
  document.addEventListener('click', handleDocumentClick, true);
  container._closeMenusHandler = handleDocumentClick;

  // Handle textarea input for dynamic button state and @mention autocomplete
  container.addEventListener('input', (e) => {
    const textarea = e.target.closest('.comment-input');
    if (textarea) {
      handleTextareaInput(container, textarea);
    }
  });

  // Hide mention suggestions when textarea loses focus (use focusout so it fires after mousedown)
  container.addEventListener('focusout', (e) => {
    if (e.target.closest('.comment-input')) {
      setTimeout(() => {
        const suggestions = container.querySelector('.mention-suggestions');
        if (suggestions) suggestions.style.display = 'none';
      }, 150);
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

  if (container._closeMenusHandler) {
    document.removeEventListener('click', container._closeMenusHandler, true);
    delete container._closeMenusHandler;
  }
}
