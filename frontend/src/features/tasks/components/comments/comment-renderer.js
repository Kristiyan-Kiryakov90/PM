/**
 * Comment Renderer
 * HTML templates and rendering functions for comments
 */

/**
 * Render comments as nested thread
 * @param {Array} comments - Comments array
 * @param {Array} companyUsers - Company users for mentions
 * @param {HTMLElement} container - Container element
 */
export function renderComments(comments, companyUsers, container, currentUserId) {
  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const commentMap = new Map();

  // Build comment map
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Build tree structure
  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) parent.replies.push(commentMap.get(comment.id));
    }
  });

  // Render
  const html = `
    <div class="comment-thread">
      <div class="comment-list">
        ${rootComments.map((c) => renderComment(commentMap.get(c.id), companyUsers, 0, currentUserId)).join('')}
        ${rootComments.length === 0 ? '<div class="text-center text-muted py-4"><i class="bi bi-chat-dots me-2"></i>No comments yet. Be the first to comment!</div>' : ''}
      </div>

      <div class="comment-form mt-3" style="position:relative">
        <div class="mention-suggestions dropdown-menu" style="display:none;position:absolute;bottom:100%;left:0;z-index:1050;max-height:180px;overflow-y:auto;min-width:200px"></div>
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
export function renderComment(comment, companyUsers, depth = 0, currentUserId = null) {
  const indentClass = depth > 0 ? 'ms-4' : '';
  const isOwn = currentUserId && comment.author_id === currentUserId;

  // Resolve author display name from team members list
  const author = companyUsers?.find(u => u.id === comment.author_id);
  const authorName = author?.full_name || author?.email || comment.author_id.substring(0, 8);

  const editedBadge = comment.edited_at
    ? `<span class="text-muted small">(edited)</span>`
    : '';

  // Resolve mention display names
  const mentions = comment.mentions || [];
  const mentionBadges = mentions.map((m) => {
    const mentionedUser = companyUsers?.find(u => u.id === m.mentioned_user_id);
    const mentionName = mentionedUser?.full_name || mentionedUser?.email || m.mentioned_user_id.substring(0, 8);
    return `<span class="badge bg-info text-dark ms-1">@${escapeHtml(mentionName)}</span>`;
  }).join('');

  // Only show Edit/Delete for own comments
  const ownActions = isOwn ? `
    <li><a class="comment-menu-item edit-comment-btn" href="#" data-comment-id="${comment.id}">
      <i class="bi bi-pencil me-2"></i>Edit
    </a></li>
    <li><hr class="dropdown-divider my-1"></li>
    <li><a class="comment-menu-item text-danger delete-comment-btn" href="#" data-comment-id="${comment.id}">
      <i class="bi bi-trash me-2"></i>Delete
    </a></li>` : '';

  return `
    <div class="comment-item ${indentClass} mb-2" data-comment-id="${comment.id}">
      <div class="comment-card card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <div>
              <strong class="comment-author">${escapeHtml(authorName)}</strong>
              ${mentionBadges}
              <span class="text-muted small ms-2">${formatDate(comment.created_at)}</span>
              ${editedBadge}
            </div>
            <div class="comment-menu-wrapper">
              <button class="comment-menu-toggle" type="button" data-comment-id="${comment.id}">
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="comment-menu-dropdown">
                <li><a class="comment-menu-item reply-comment-btn" href="#" data-comment-id="${comment.id}">
                  <i class="bi bi-reply me-2"></i>Reply
                </a></li>
                ${ownActions}
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
          ${comment.replies.map((r) => renderComment(r, companyUsers, depth + 1, currentUserId)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
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
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
