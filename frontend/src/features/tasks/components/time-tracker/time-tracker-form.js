/**
 * Time Tracker Manual Entry Form
 * Handles manual time entry form logic
 */

import {
  createManualEntry,
} from '../../services/time-tracking-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';

/**
 * Toggle manual entry form
 * @param {HTMLElement} container - Container element
 */
export function toggleManualEntryForm(container) {
  const form = container.querySelector('#manualEntryForm');
  const icon = container.querySelector('#manualEntryToggleIcon');

  if (form.style.display === 'none') {
    form.style.display = 'block';
    icon.textContent = '▾';
    // Set default times (now - 1 hour to now)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    container.querySelector('#manualStartTime').value = formatDateTimeLocal(oneHourAgo);
    container.querySelector('#manualEndTime').value = formatDateTimeLocal(now);
  } else {
    form.style.display = 'none';
    icon.textContent = '▸';
  }
}

/**
 * Handle save manual entry
 * @param {HTMLElement} container - Container element
 * @param {number} taskId - Task ID
 * @param {Function} render - Render function to update UI
 */
export async function handleSaveManualEntry(container, taskId, render) {
  try {
    const startTime = container.querySelector('#manualStartTime').value;
    const endTime = container.querySelector('#manualEndTime').value;
    const description = container.querySelector('#manualDescription').value;

    if (!startTime || !endTime) {
      uiHelpers.showError('Please enter start and end times');
      return;
    }

    await createManualEntry(taskId, new Date(startTime).toISOString(), new Date(endTime).toISOString(), description);

    uiHelpers.showSuccess('Time entry added');
    toggleManualEntryForm(container);
    clearManualEntryForm(container);
    await render();
  } catch (error) {
    console.error('Error saving manual entry:', error);
    uiHelpers.showError(error.message || 'Failed to save time entry');
  }
}

/**
 * Clear manual entry form
 * @param {HTMLElement} container - Container element
 */
export function clearManualEntryForm(container) {
  container.querySelector('#manualStartTime').value = '';
  container.querySelector('#manualEndTime').value = '';
  container.querySelector('#manualDescription').value = '';
}

/**
 * Format date for datetime-local input
 * @param {Date} date - Date object
 * @returns {string} Formatted datetime string
 */
function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
