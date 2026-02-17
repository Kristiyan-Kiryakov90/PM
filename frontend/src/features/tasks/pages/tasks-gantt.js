/**
 * Task Gantt View Module
 * Handles Gantt chart rendering and view control
 */

import {
  initGanttChart,
  destroyGanttChart,
  getMissingDatesTasks,
} from '@tasks/components/gantt-chart.js';
import { ganttService } from '@services/gantt-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import {
  addTaskBarReorderControls,
} from './tasks-gantt-actions.js';

// Re-export action handlers for external use
export {
  handleShowCriticalPath,
  handleAutoSchedule,
  exposeGanttFunctions,
} from './tasks-gantt-actions.js';

// Gantt state
let ganttInstance = null;
let isLoadingGantt = false; // Prevent infinite loops
let ganttSortOrder = 'gantt_position'; // Default sort order
let ganttLibsLoaded = false;

/**
 * Dynamically load Frappe Gantt CSS and JS on first use
 */
async function loadGanttLibraries() {
  if (ganttLibsLoaded || typeof Gantt !== 'undefined') {
    ganttLibsLoaded = true;
    return;
  }

  const BASE = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/';

  await Promise.all([
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = BASE + 'frappe-gantt.min.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    }),
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = BASE + 'frappe-gantt.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }),
  ]);

  ganttLibsLoaded = true;
}

/**
 * Get current Gantt sort order
 */
export function getGanttSortOrder() {
  return ganttSortOrder;
}

/**
 * Set Gantt sort order
 */
export function setGanttSortOrder(order) {
  ganttSortOrder = order;
}

/**
 * Load and render Gantt chart
 * Dates set in Gantt persist - auto-schedule only runs when user clicks the button
 */
export async function loadGanttView(tasks, currentFilters, openViewModal) {
  // Prevent infinite loop - don't reload if already loading
  if (isLoadingGantt) {
    return;
  }

  try {
    isLoadingGantt = true;

    // Lazy-load Frappe Gantt on first use
    await loadGanttLibraries();

    const container = document.getElementById('ganttChart');
    const emptyState = document.querySelector('.gantt-empty');

    if (!container || !emptyState) {
      return;
    }

    if (!currentFilters.project_id) {
      // No project selected - show empty state
      container.style.display = 'none';
      emptyState.style.display = 'flex';
      const emptyMessage = emptyState.querySelector('p');
      emptyMessage.textContent = 'Please select a project from the filter dropdown to view Gantt chart.';
      isLoadingGantt = false;
      return;
    }

    // Initialize Gantt chart (no auto-scheduling - dates persist until user changes them)
    ganttInstance = await initGanttChart(container, {
      project_id: currentFilters.project_id,
      priority: currentFilters.priority,
      assigned_to: currentFilters.assigned_to,
      tag_id: currentFilters.tag_id,
      sort_by: ganttSortOrder,
      viewMode: 'Day',
      onTaskClick: (task) => {
        openViewModal(parseInt(task.id));
      },
      onDateChange: async (task, start, end) => {
        try {
          const result = await ganttService.updateTaskDates(parseInt(task.id), {
            start_date: start.toISOString(),
            due_date: end.toISOString(),
          });

          uiHelpers.showSuccess(`Task dates updated: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);

          // Update local tasks array without full reload
          const taskIndex = tasks.findIndex(t => t.id === parseInt(task.id));
          if (taskIndex !== -1) {
            tasks[taskIndex].start_date = start.toISOString();
            tasks[taskIndex].due_date = end.toISOString();
          }
        } catch (error) {
          console.error('Error updating task dates:', error);
          uiHelpers.showError('Failed to update task dates: ' + error.message);
        }
      },
      onProgressChange: async (task, progress) => {
        // Optionally update task status based on progress
      },
    });

    // Check if Gantt initialized successfully
    const hasGanttChart = ganttInstance !== null;

    container.style.display = hasGanttChart ? 'block' : 'none';
    emptyState.style.display = hasGanttChart ? 'none' : 'flex';

    if (!hasGanttChart) {
      const emptyMessage = emptyState.querySelector('p');
      if (tasks.length === 0) {
        emptyMessage.textContent = 'No tasks found. Create some tasks first.';
      } else {
        const missingCount = getMissingDatesTasks(tasks).length;
        emptyMessage.textContent = missingCount > 0
          ? `${missingCount} task(s) need start date and due date to appear on the Gantt chart.`
          : 'No tasks with dates to display.';
      }
    }

    // Add drag-and-drop reorder controls to task bars
    // Wrap reloadGanttView to always pass correct params
    const reloadGantt = () => loadGanttView(tasks, currentFilters, openViewModal);
    addTaskBarReorderControls(currentFilters, reloadGantt);

    isLoadingGantt = false;
  } catch (error) {
    isLoadingGantt = false;
    console.error('Error loading Gantt view:', error);
    uiHelpers.showError('Failed to load Gantt view');
  }
}

/**
 * Cleanup Gantt view when switching away
 */
export function cleanupGanttView() {
  console.log('🧹 Destroying Gantt instance...');
  destroyGanttChart();
  ganttInstance = null;
  isLoadingGantt = false;
}
