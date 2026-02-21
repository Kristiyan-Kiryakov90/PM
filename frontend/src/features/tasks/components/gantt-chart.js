/**
 * Gantt Chart Component - Main Module
 * Integrates Frappe Gantt library with TaskFlow
 */

import { ganttService } from '@services/gantt-service.js';
import { teamService } from '@services/team-service.js';
import {
  transformTasksForGantt,
  scrollToToday,
  hideDefaultTodayMarker,
  addCustomTodayMarker,
  updateWeekViewHeaders,
  setupGanttPanning,
} from './gantt/gantt-renderer.js';
import { formatDate } from './gantt/gantt-utils.js';

// Re-export utilities for external use
export {
  calculateDuration,
  validateTaskDates,
  getDisplayableTasks,
  getMissingDatesTasks,
} from './gantt/gantt-utils.js';

let ganttInstance = null;
let currentOptions = {};
let cachedTeamMembers = [];

/**
 * Initialize Gantt chart
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Gantt instance
 */
export async function initGanttChart(container, options = {}) {
  try {

    // Validate Frappe Gantt is loaded
    if (typeof Gantt === 'undefined') {
      console.error('❌ Frappe Gantt library not loaded');
      throw new Error('Frappe Gantt library not loaded. Include CDN script in HTML.');
    }

    // Load team members if not cached
    if (cachedTeamMembers.length === 0) {
      try {
        cachedTeamMembers = await teamService.getTeamMembers();
      } catch (error) {
        console.error('Error loading team members:', error);
      }
    }

    // Store options
    currentOptions = {
      project_id: options.project_id,
      viewMode: options.viewMode || 'Day',
      onTaskClick: options.onTaskClick || (() => {}),
      onDateChange: options.onDateChange || (() => {}),
      onDependencyCreate: options.onDependencyCreate || (() => {}),
      ...options
    };

    // Build filters - pass all filters to SQL query for better performance
    const filters = {};
    if (currentOptions.project_id) {
      filters.project_id = currentOptions.project_id;
    }
    if (currentOptions.sort_by) {
      filters.sort_by = currentOptions.sort_by;
    }
    if (currentOptions.priority) {
      filters.priority = currentOptions.priority;
    }
    if (currentOptions.assigned_to) {
      filters.assigned_to = currentOptions.assigned_to;
    }

    let tasks = await ganttService.getGanttTasks(filters);

    // Only tag filtering remains client-side (many-to-many relationship)
    if (currentOptions.tag_id) {
      const tagId = parseInt(currentOptions.tag_id, 10);
      tasks = tasks.filter(task =>
        task.task_tags &&
        task.task_tags.length > 0 &&
        task.task_tags.some(tt => tt.tags?.id === tagId)
      );
    }

    // Transform tasks for Frappe Gantt
    const ganttTasks = transformTasksForGantt(tasks, cachedTeamMembers);

    if (ganttTasks.length === 0) {
      container.innerHTML = '';
      return null;
    }

    // Clear container
    container.innerHTML = '';


    // Initialize Frappe Gantt
    ganttInstance = new Gantt(container, ganttTasks, {
      header_height: 50,
      column_width: 30,
      step: 24,
      view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
      bar_height: 30,
      bar_corner_radius: 3,
      arrow_curve: 5,
      padding: 18,
      view_mode: currentOptions.viewMode,
      date_format: 'YYYY-MM-DD',
      language: 'en',
      readonly: false,
      custom_popup_html: (task) => {
        return `
          <div class="gantt-popup">
            <h5 class="mb-2">${task.name}</h5>
            <p class="mb-1"><strong>Start:</strong> ${formatDate(task._start)}</p>
            <p class="mb-1"><strong>End:</strong> ${formatDate(task._end)}</p>
            <p class="mb-1"><strong>Progress:</strong> ${task.progress}%</p>
            ${task.assignee ? `<p class="mb-0"><strong>Assignee:</strong> ${task.assignee}</p>` : ''}
            <p class="mb-0 mt-2 text-muted" style="font-size: 0.7rem;">Drag left/right to change dates. Drag up/down to reorder.</p>
          </div>
        `;
      },
      on_click: (task) => {
        currentOptions.onTaskClick(task);
      },
      on_date_change: (task, start, end) => {
        currentOptions.onDateChange(task, start, end);
      },
      on_view_change: (mode) => {
        // Re-add today marker when view changes
        setTimeout(() => {
          hideDefaultTodayMarker(ganttInstance);
          addCustomTodayMarker(ganttInstance, mode);

          // Show week numbers in week view
          if (mode === 'Week') {
            updateWeekViewHeaders(ganttInstance);
          }
        }, 100);
      }
    });

    // Hide default today marker, add custom one, scroll to today, enable panning
    setTimeout(() => {
      hideDefaultTodayMarker(ganttInstance);
      addCustomTodayMarker(ganttInstance, currentOptions.viewMode);
      scrollToToday(ganttInstance, currentOptions.viewMode);
      setupGanttPanning(ganttInstance);
    }, 100);

    return ganttInstance;
  } catch (error) {
    console.error('Error initializing Gantt chart:', error);
    throw error;
  }
}

/**
 * Change Gantt view mode
 * @param {string} mode - View mode (Day, Week, Month, Year)
 */
export function changeViewMode(mode) {
  if (ganttInstance && ganttInstance.change_view_mode) {
    ganttInstance.change_view_mode(mode);
    currentOptions.viewMode = mode;

    // Re-add today marker, scroll to it, re-enable panning after view mode re-renders
    setTimeout(() => {
      hideDefaultTodayMarker(ganttInstance);
      addCustomTodayMarker(ganttInstance, mode);
      scrollToToday(ganttInstance, mode);
      setupGanttPanning(ganttInstance);

      // Show week numbers in week view
      if (mode === 'Week') {
        updateWeekViewHeaders(ganttInstance);
      }
    }, 300);
  }
}

/**
 * Highlight critical path tasks
 * @param {Array<number>} criticalTaskIds - Array of critical task IDs
 */
export function highlightCriticalPath(criticalTaskIds) {
  if (!ganttInstance) return;

  // Remove existing critical path classes
  document.querySelectorAll('.bar-wrapper.critical-path').forEach(el => {
    el.classList.remove('critical-path');
  });

  // Add critical path class to specified tasks
  criticalTaskIds.forEach(taskId => {
    const barWrapper = document.querySelector(`.bar-wrapper[data-id="${taskId}"]`);
    if (barWrapper) {
      barWrapper.classList.add('critical-path');
    }
  });
}

/**
 * Refresh Gantt chart with current filters
 * @param {number} projectId - Project ID
 */
export async function refreshGantt(projectId) {
  if (!ganttInstance) return;

  const container = ganttInstance.$svg.parentElement;
  currentOptions.project_id = projectId;

  await initGanttChart(container, currentOptions);
}

/**
 * Destroy Gantt chart instance
 */
export function destroyGanttChart() {
  if (ganttInstance) {
    // Clean up panning listeners
    if (ganttInstance.$container?._panCleanup) {
      ganttInstance.$container._panCleanup();
    }
    // Clean up Frappe Gantt
    const container = ganttInstance.$svg?.parentElement;
    if (container) {
      container.innerHTML = '';
    }
    ganttInstance = null;
  }
  currentOptions = {};
}

/**
 * Get current Gantt instance
 * @returns {Object|null} Gantt instance
 */
export function getGanttInstance() {
  return ganttInstance;
}

// Default export for backwards compatibility
export default {
  initGanttChart,
  changeViewMode,
  highlightCriticalPath,
  refreshGantt,
  destroyGanttChart,
  getGanttInstance,
};
