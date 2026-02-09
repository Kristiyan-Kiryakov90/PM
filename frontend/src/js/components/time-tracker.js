/**
 * Time Tracker Component
 * Timer widget and time entry management for tasks
 * Phase 3A: Time Tracking
 */

import {
  startTimer,
  stopTimer,
  getActiveTimer,
  createManualEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTaskTimeEntries,
  getTaskTotalTime,
  formatDuration,
  formatDurationHuman,
  getElapsedSeconds,
  subscribeToTaskTimeEntries,
} from '../services/time-tracking-service.js';
import { showError, showSuccess } from '../utils/ui-helpers.js';

/**
 * Initialize time tracker for a task
 * @param {HTMLElement} container - Container element
 * @param {number} taskId - Task ID
 * @returns {Object} API for controlling the time tracker
 */
export async function initTimeTracker(container, taskId) {
  if (!container || !taskId) {
    console.error('Time tracker requires container and task ID');
    return;
  }

  let activeTimer = null;
  let timerInterval = null;
  let timeEntries = [];
  let subscription = null;

  /**
   * Render the time tracker UI
   */
  async function render() {
    try {
      // Get active timer
      activeTimer = await getActiveTimer();
      const isTimerForThisTask = activeTimer && activeTimer.task_id === taskId;

      // Get time entries for this task
      timeEntries = await getTaskTimeEntries(taskId);

      // Get total time
      const totalSeconds = await getTaskTotalTime(taskId);

      container.innerHTML = `
        <div class="time-tracker">
          <!-- Timer Section -->
          <div class="time-tracker-header">
            <div class="time-tracker-title">
              <span class="time-tracker-icon">⏱️</span>
              <h4>Time Tracking</h4>
            </div>
            <div class="time-tracker-total">
              <span class="time-tracker-total-label">Total:</span>
              <span class="time-tracker-total-value">${formatDurationHuman(totalSeconds)}</span>
            </div>
          </div>

          <!-- Active Timer -->
          <div class="time-tracker-timer">
            ${
              isTimerForThisTask
                ? `
              <div class="timer-active">
                <div class="timer-display" id="timerDisplay">
                  ${formatDuration(getElapsedSeconds(activeTimer.start_time))}
                </div>
                <button class="btn btn-danger btn-sm" id="stopTimerBtn">
                  <span>⏹️</span> Stop Timer
                </button>
              </div>
            `
                : activeTimer
                  ? `
              <div class="timer-blocked">
                <p class="text-muted mb-2">
                  <span>⏱️</span> Timer running for "${escapeHtml(activeTimer.tasks?.title || activeTimer.task_title)}"
                </p>
                <button class="btn btn-outline-secondary btn-sm" disabled>
                  <span>▶️</span> Start Timer
                </button>
              </div>
            `
                  : `
              <button class="btn btn-primary btn-sm" id="startTimerBtn">
                <span>▶️</span> Start Timer
              </button>
            `
            }
          </div>

          <!-- Manual Entry Form (collapsed by default) -->
          <div class="time-tracker-manual">
            <button class="btn btn-link btn-sm p-0" id="toggleManualEntryBtn">
              <span id="manualEntryToggleIcon">▸</span> Add Manual Entry
            </button>
            <div class="manual-entry-form" id="manualEntryForm" style="display: none;">
              <div class="row g-2 mt-2">
                <div class="col-md-6">
                  <label class="form-label small">Start Time</label>
                  <input type="datetime-local" class="form-control form-control-sm" id="manualStartTime" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label small">End Time</label>
                  <input type="datetime-local" class="form-control form-control-sm" id="manualEndTime" required>
                </div>
                <div class="col-12">
                  <label class="form-label small">Description (optional)</label>
                  <input type="text" class="form-control form-control-sm" id="manualDescription" placeholder="What did you work on?">
                </div>
                <div class="col-12">
                  <button class="btn btn-primary btn-sm" id="saveManualEntryBtn">Save Entry</button>
                  <button class="btn btn-secondary btn-sm" id="cancelManualEntryBtn">Cancel</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Time Entries List -->
          <div class="time-tracker-entries">
            <h5 class="time-tracker-entries-title">Time Entries</h5>
            ${
              timeEntries.length === 0
                ? `
              <div class="time-tracker-empty">
                <p class="text-muted">No time entries yet</p>
              </div>
            `
                : timeEntries
                    .map(
                      (entry) => `
              <div class="time-entry" data-entry-id="${entry.id}">
                <div class="time-entry-header">
                  <span class="time-entry-date">${formatEntryDate(entry.start_time)}</span>
                  <div class="time-entry-actions">
                    <button class="btn-icon time-entry-delete" data-entry-id="${entry.id}" title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
                <div class="time-entry-body">
                  <div class="time-entry-duration">
                    ${entry.duration_seconds ? formatDuration(entry.duration_seconds) : 'Running...'}
                  </div>
                  <div class="time-entry-time">
                    ${formatTime(entry.start_time)} - ${entry.end_time ? formatTime(entry.end_time) : 'Now'}
                  </div>
                  ${entry.description ? `<div class="time-entry-description">${escapeHtml(entry.description)}</div>` : ''}
                  ${entry.is_manual ? '<span class="badge bg-secondary">Manual</span>' : ''}
                </div>
              </div>
            `
                    )
                    .join('')
            }
          </div>
        </div>
      `;

      setupEventListeners();
      startTimerUpdate();
    } catch (error) {
      console.error('Error rendering time tracker:', error);
      container.innerHTML = `
        <div class="time-tracker-error">
          <p class="text-danger">Failed to load time tracker</p>
        </div>
      `;
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Start timer button
    const startBtn = container.querySelector('#startTimerBtn');
    if (startBtn) {
      startBtn.addEventListener('click', handleStartTimer);
    }

    // Stop timer button
    const stopBtn = container.querySelector('#stopTimerBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', handleStopTimer);
    }

    // Toggle manual entry form
    const toggleBtn = container.querySelector('#toggleManualEntryBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleManualEntryForm);
    }

    // Save manual entry
    const saveBtn = container.querySelector('#saveManualEntryBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveManualEntry);
    }

    // Cancel manual entry
    const cancelBtn = container.querySelector('#cancelManualEntryBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        toggleManualEntryForm();
        clearManualEntryForm();
      });
    }

    // Delete entry buttons - use event delegation
    container.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.time-entry-delete');
      if (deleteBtn) {
        const entryId = parseInt(deleteBtn.dataset.entryId, 10);
        handleDeleteEntry(entryId);
      }
    });
  }

  /**
   * Handle start timer
   */
  async function handleStartTimer() {
    try {
      await startTimer(taskId);
      showSuccess('Timer started');
      await render();
    } catch (error) {
      console.error('Error starting timer:', error);
      showError(error.message || 'Failed to start timer');
    }
  }

  /**
   * Handle stop timer
   */
  async function handleStopTimer() {
    try {
      if (!activeTimer) return;
      await stopTimer(activeTimer.id);
      showSuccess('Timer stopped');
      await render();
    } catch (error) {
      console.error('Error stopping timer:', error);
      showError('Failed to stop timer');
    }
  }

  /**
   * Toggle manual entry form
   */
  function toggleManualEntryForm() {
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
   */
  async function handleSaveManualEntry() {
    try {
      const startTime = container.querySelector('#manualStartTime').value;
      const endTime = container.querySelector('#manualEndTime').value;
      const description = container.querySelector('#manualDescription').value;

      if (!startTime || !endTime) {
        showError('Please enter start and end times');
        return;
      }

      await createManualEntry(taskId, new Date(startTime).toISOString(), new Date(endTime).toISOString(), description);

      showSuccess('Time entry added');
      toggleManualEntryForm();
      clearManualEntryForm();
      await render();
    } catch (error) {
      console.error('Error saving manual entry:', error);
      showError(error.message || 'Failed to save time entry');
    }
  }

  /**
   * Clear manual entry form
   */
  function clearManualEntryForm() {
    container.querySelector('#manualStartTime').value = '';
    container.querySelector('#manualEndTime').value = '';
    container.querySelector('#manualDescription').value = '';
  }

  /**
   * Handle delete entry
   */
  async function handleDeleteEntry(entryId) {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      await deleteTimeEntry(entryId);
      showSuccess('Time entry deleted');
      await render();
    } catch (error) {
      console.error('Error deleting entry:', error);
      showError('Failed to delete time entry');
    }
  }

  /**
   * Start updating timer display
   */
  function startTimerUpdate() {
    // Clear existing interval
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    // Update every second if timer is running
    if (activeTimer && activeTimer.task_id === taskId) {
      timerInterval = setInterval(() => {
        const display = container.querySelector('#timerDisplay');
        if (display && activeTimer) {
          display.textContent = formatDuration(getElapsedSeconds(activeTimer.start_time));
        }
      }, 1000);
    }
  }

  /**
   * Subscribe to real-time updates
   */
  function subscribeToUpdates() {
    subscription = subscribeToTaskTimeEntries(taskId, async () => {
      await render();
    });
  }

  /**
   * Destroy the time tracker
   */
  function destroy() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    if (subscription) {
      subscription.unsubscribe();
    }
  }

  // Initialize
  await render();
  subscribeToUpdates();

  // Return API
  return {
    render,
    destroy,
  };
}

/**
 * Utility functions
 */
function escapeHtml(text) {
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

function formatEntryDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
