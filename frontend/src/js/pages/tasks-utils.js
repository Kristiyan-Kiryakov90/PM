/**
 * Task Utility Functions
 * Shared helper functions for task operations
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Capitalize first letter
 */
export function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get contrasting text color for a background color
 * @param {string} hexColor - Hex color code (e.g., '#ffffff')
 * @returns {string} - '#ffffff' (white) or '#000000' (black)
 */
export function getContrastingTextColor(hexColor) {
  if (!hexColor) return '#ffffff';

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance (perceived brightness)
  // Using the formula: (0.299*R + 0.587*G + 0.114*B)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date relative to now
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Calculate task age (time since creation) in days
 */
export function getTaskAge(createdAt) {
  if (!createdAt) return '';

  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / 86400000);

  return `${diffDays}`;
}

/**
 * Format status for display
 */
export function formatStatus(status) {
  const statusMap = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'in_review': 'In Review',
    'done': 'Done'
  };
  return statusMap[status] || status;
}

/**
 * Format priority for display
 */
export function formatPriority(priority) {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';
}

/**
 * Get badge class for status
 */
export function getStatusBadgeClass(status) {
  const classMap = {
    'todo': 'secondary',
    'in_progress': 'primary',
    'in_review': 'warning',
    'done': 'success'
  };
  return classMap[status] || 'secondary';
}

/**
 * Get badge class for priority
 */
export function getPriorityBadgeClass(priority) {
  const classMap = {
    'low': 'secondary',
    'medium': 'info',
    'high': 'warning',
    'urgent': 'danger'
  };
  return classMap[priority] || 'info';
}

/**
 * Format due date with relative time
 */
export function formatDueDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<span class="text-danger">${date.toLocaleDateString()}</span>`;
  } else if (diffDays === 0) {
    return '<span class="text-warning">Today</span>';
  } else if (diffDays === 1) {
    return '<span class="text-warning">Tomorrow</span>';
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Filter tasks based on filters
 */
export function filterTasks(tasks, filters) {
  return tasks.filter(task => {
    // Tag filter
    if (filters.tag_id) {
      const hasTag = task.tags?.some(tag => tag.id === parseInt(filters.tag_id));
      if (!hasTag) return false;
    }

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesTitle = task.title?.toLowerCase().includes(search);
      const matchesDescription = task.description?.toLowerCase().includes(search);
      if (!matchesTitle && !matchesDescription) return false;
    }

    return true;
  });
}
