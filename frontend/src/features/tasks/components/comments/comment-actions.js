/**
 * Comment Actions
 * Action handlers for comment operations (post, reply, edit, delete)
 */

import { commentService } from '@services/comment-service.js';
import { checklistService } from '@services/checklist-service.js';
import { escapeHtml } from './comment-renderer.js';

/**
 * Handle post comment
 * @param {HTMLElement} container - Container element
 * @param {Function} loadComments - Function to reload comments
 */
export async function handlePostComment(container, loadComments) {
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
    await commentService.createComment({
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
 * @param {Function} loadComments - Function to reload comments
 */
export function handleReplyComment(container, commentId, loadComments) {
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
      await commentService.createComment({
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
 * @param {Function} loadComments - Function to reload comments
 */
export async function handleEditComment(container, commentId, loadComments) {
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
      await commentService.updateComment(commentId, { content: newContent });

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
 * @param {Function} loadComments - Function to reload comments
 */
export async function handleDeleteComment(container, commentId, loadComments) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  try {
    await commentService.deleteComment(commentId);
    await loadComments(parseInt(container.dataset.taskId), container);
  } catch (error) {
    console.error('Failed to delete comment:', error);
    alert('Failed to delete comment. Please try again.');
  }
}

/**
 * Handle textarea input to update button state
 * @param {HTMLElement} container - Container element
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
export function handleTextareaInput(container, textarea) {
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

  // @mention autocomplete
  handleMentionAutocomplete(container, textarea);
}

/**
 * Detect @mention at cursor and show autocomplete suggestions
 */
function handleMentionAutocomplete(container, textarea) {
  const suggestionsEl = container.querySelector('.mention-suggestions');
  if (!suggestionsEl) return;

  const companyUsers = container._companyUsers || [];
  const pos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, pos);
  const mentionMatch = textBefore.match(/@(\w*)$/);

  if (!mentionMatch || companyUsers.length === 0) {
    suggestionsEl.style.display = 'none';
    return;
  }

  const query = mentionMatch[1].toLowerCase();
  const matches = companyUsers.filter(u => {
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  }).slice(0, 6);

  if (matches.length === 0) {
    suggestionsEl.style.display = 'none';
    return;
  }

  suggestionsEl.innerHTML = matches.map(u => `
    <a class="dropdown-item mention-suggestion-item d-flex align-items-center gap-2 py-2"
       href="#"
       data-user-id="${u.id}"
       data-user-name="${escapeAttr(u.full_name || u.email)}">
      <span class="fw-semibold">${escapeHtml(u.full_name || u.email)}</span>
      ${u.full_name ? `<span class="text-muted small">${escapeHtml(u.email)}</span>` : ''}
    </a>
  `).join('');
  suggestionsEl.style.display = 'block';

  // Handle suggestion click
  suggestionsEl.querySelectorAll('.mention-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent textarea blur
      const userName = item.dataset.userName;
      // Replace the @query with @full_name
      const before = textarea.value.substring(0, pos - mentionMatch[0].length);
      const after = textarea.value.substring(pos);
      textarea.value = before + '@' + userName + ' ' + after;
      // Move cursor after inserted mention
      const newPos = before.length + userName.length + 2;
      textarea.setSelectionRange(newPos, newPos);
      suggestionsEl.style.display = 'none';
      textarea.focus();
      // Re-trigger button state
      const postBtn = container.querySelector('.post-comment-btn');
      if (postBtn) postBtn.disabled = !textarea.value.trim();
    });
  });
}

function escapeAttr(text) {
  return String(text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Get or create the "Action Items" checklist
 * @param {number} taskId - Task ID
 * @returns {Promise<Object>} Checklist object
 */
async function getOrCreateActionItemsChecklist(taskId) {
  try {
    const checklists = await checklistService.getTaskChecklists(taskId);

    // Look for existing "Action Items" checklist
    let actionItemsChecklist = checklists.find((c) => c.title === 'Action Items');

    // Create if doesn't exist
    if (!actionItemsChecklist) {
      actionItemsChecklist = await checklistService.createChecklist({
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
export async function createActionItemChecklistItem(taskId, commentId, content) {
  try {
    console.log('🔧 Creating checklist item for action item:', { taskId, commentId, content });

    const checklist = await getOrCreateActionItemsChecklist(taskId);
    console.log('📋 Got/created checklist:', checklist);

    // Create checklist item with comment ID in metadata (if your schema supports it)
    // For now, we'll use the content field to link them
    const itemContent = `${content} (from comment)`;

    const item = await checklistService.createChecklistItem({
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

/**
 * Refresh the task modal to update checklists
 * @param {number} taskId - Task ID
 */
export async function refreshTaskModal(taskId) {
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
