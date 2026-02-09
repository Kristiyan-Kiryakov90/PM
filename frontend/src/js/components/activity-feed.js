/**
 * Activity Feed Component
 * Renders a feed of recent activity with real-time updates
 */

import {
  getRecentActivity,
  subscribeToActivity,
  formatActivity,
  getActivityChanges,
} from '@services/activity-service.js';

/**
 * Initialize activity feed in a container
 * @param {HTMLElement} container - Container element
 * @param {Object} options - { limit, entity_type, entity_id, realtime }
 */
export async function initActivityFeed(container, options = {}) {
  if (!container) return;

  const { limit = 20, entity_type = null, entity_id = null, realtime = true } = options;

  container.dataset.initialized = 'true';
  container.dataset.limit = limit;
  if (entity_type) container.dataset.entityType = entity_type;
  if (entity_id) container.dataset.entityId = entity_id;

  // Load initial activity
  await loadActivity(container);

  // Subscribe to real-time updates if enabled
  if (realtime) {
    const subscription = subscribeToActivity(async () => {
      await loadActivity(container);
    });

    // Store subscription for cleanup
    container.dataset.subscription = JSON.stringify(subscription);
  }
}

/**
 * Load and render activity
 * @param {HTMLElement} container - Container element
 */
async function loadActivity(container) {
  try {
    const limit = parseInt(container.dataset.limit) || 20;
    const entity_type = container.dataset.entityType || null;
    const entity_id = container.dataset.entityId ? parseInt(container.dataset.entityId) : null;

    const activities = await getRecentActivity({
      limit,
      entity_type,
      entity_id,
    });

    renderActivityFeed(activities, container);
  } catch (error) {
    console.error('Failed to load activity:', error);
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Failed to load activity feed. Please try again.
      </div>
    `;
  }
}

/**
 * Render activity feed
 * @param {Array} activities - Activity entries
 * @param {HTMLElement} container - Container element
 */
function renderActivityFeed(activities, container) {
  if (!activities || activities.length === 0) {
    container.innerHTML = `
      <div class="activity-empty">
        <div class="text-center py-4">
          <i class="bi bi-clock-history" style="font-size: 3rem; color: var(--bs-secondary);"></i>
          <p class="text-muted mt-2">No recent activity</p>
        </div>
      </div>
    `;
    return;
  }

  // Group activities by date
  const groupedActivities = groupByDate(activities);

  const html = `
    <div class="activity-feed">
      ${Object.entries(groupedActivities)
        .map(([date, items]) => renderActivityGroup(date, items))
        .join('')}
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Group activities by date
 * @param {Array} activities - Activity entries
 * @returns {Object} Grouped activities
 */
function groupByDate(activities) {
  const groups = {};

  activities.forEach((activity) => {
    const date = new Date(activity.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel;
    if (isSameDay(date, today)) {
      dateLabel = 'Today';
    } else if (isSameDay(date, yesterday)) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }

    groups[dateLabel].push(activity);
  });

  return groups;
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
function isSameDay(date1, date2) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Render activity group (by date)
 * @param {string} dateLabel - Date label
 * @param {Array} activities - Activities for this date
 * @returns {string} HTML
 */
function renderActivityGroup(dateLabel, activities) {
  return `
    <div class="activity-group">
      <div class="activity-date-header">
        <span class="activity-date-label">${dateLabel}</span>
      </div>
      <div class="activity-items">
        ${activities.map((activity) => renderActivityItem(activity)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single activity item
 * @param {Object} activity - Activity entry
 * @returns {string} HTML
 */
function renderActivityItem(activity) {
  const formatted = formatActivity(activity);
  const time = formatTime(new Date(activity.created_at));
  const changes = getActivityChanges(activity.details);

  const changesHtml =
    changes.length > 0
      ? `
    <div class="activity-changes">
      ${changes
        .map(
          (change) => `
        <div class="activity-change">
          <span class="change-field">${formatFieldName(change.field)}:</span>
          <span class="change-old">${formatValue(change.oldValue)}</span>
          <i class="bi bi-arrow-right mx-1"></i>
          <span class="change-new">${formatValue(change.newValue)}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `
      : '';

  return `
    <div class="activity-item" data-activity-id="${activity.id}">
      <div class="activity-icon">
        <span class="activity-icon-emoji">${formatted.icon}</span>
      </div>
      <div class="activity-content">
        <div class="activity-message">
          ${escapeHtml(formatted.message)}
          <span class="activity-time">${time}</span>
        </div>
        ${changesHtml}
      </div>
    </div>
  `;
}

/**
 * Format time for display
 * @param {Date} date - Date object
 * @returns {string} Formatted time
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format field name for display
 * @param {string} field - Field name
 * @returns {string} Formatted field name
 */
function formatFieldName(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format value for display
 * @param {*} value - Value
 * @returns {string} Formatted value
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return '<em>none</em>';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return escapeHtml(String(value));
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
 * Cleanup subscription when component is destroyed
 * @param {HTMLElement} container - Container element
 */
export function destroyActivityFeed(container) {
  const subscription = container.dataset.subscription;
  if (subscription) {
    const sub = JSON.parse(subscription);
    if (sub && sub.unsubscribe) {
      sub.unsubscribe();
    }
    delete container.dataset.subscription;
  }
  delete container.dataset.initialized;
}

/**
 * Refresh activity feed
 * @param {HTMLElement} container - Container element
 */
export async function refreshActivityFeed(container) {
  await loadActivity(container);
}
