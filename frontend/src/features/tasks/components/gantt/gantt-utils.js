/**
 * Gantt Utility Functions
 * Date formatting, validation, and task filtering utilities
 */

/**
 * Format date for Frappe Gantt (YYYY-MM-DD)
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date
 */
export function formatDateForGantt(date) {
  if (!date) return '';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

/**
 * Calculate task duration in days
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {number} Duration in days
 */
export function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Validate task dates
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Object} { valid, error }
 */
export function validateTaskDates(startDate, endDate) {
  if (!startDate || !endDate) {
    return { valid: false, error: 'Both start date and due date are required' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return { valid: false, error: 'Due date must be after start date' };
  }

  return { valid: true, error: null };
}

/**
 * Get tasks that can be displayed on Gantt
 * @param {Array} tasks - All tasks
 * @returns {Array} Tasks with valid dates
 */
export function getDisplayableTasks(tasks) {
  return tasks.filter(task => task.start_date && task.due_date);
}

/**
 * Get tasks missing dates
 * @param {Array} tasks - All tasks
 * @returns {Array} Tasks without start_date or due_date
 */
export function getMissingDatesTasks(tasks) {
  return tasks.filter(task => !task.start_date || !task.due_date);
}

/**
 * Get ISO week number for a date
 * @param {Date} date - The date
 * @returns {number} Week number (1-53)
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
