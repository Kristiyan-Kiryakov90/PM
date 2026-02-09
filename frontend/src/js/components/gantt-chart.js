import { getGanttTasks, updateTaskDates, addDependency } from '../services/gantt-service.js';

/**
 * Gantt Chart Component - Integrates Frappe Gantt library
 */

let ganttInstance = null;
let currentOptions = {};

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

    // Store options
    currentOptions = {
      project_id: options.project_id,
      viewMode: options.viewMode || 'Day',
      onTaskClick: options.onTaskClick || (() => {}),
      onDateChange: options.onDateChange || (() => {}),
      onProgressChange: options.onProgressChange || (() => {}),
      onDependencyCreate: options.onDependencyCreate || (() => {}),
      ...options
    };

    // Build filters
    const filters = {};
    if (currentOptions.project_id) {
      filters.project_id = currentOptions.project_id;
    }
    if (currentOptions.sort_by) {
      filters.sort_by = currentOptions.sort_by;
    }


    const tasks = await getGanttTasks(filters);

    // Transform tasks for Frappe Gantt
    const ganttTasks = transformTasksForGantt(tasks);

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
      readonly: false, // Enable dragging
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
      on_progress_change: (task, progress) => {
        currentOptions.onProgressChange(task, progress);
      },
      on_view_change: (mode) => {
      }
    });

    return ganttInstance;
  } catch (error) {
    console.error('Error initializing Gantt chart:', error);
    throw error;
  }
}

/**
 * Transform TaskFlow tasks to Frappe Gantt format
 * @param {Array} tasks - TaskFlow tasks
 * @returns {Array} Frappe Gantt tasks
 */
export function transformTasksForGantt(tasks) {

  const filtered = tasks.filter(task => {
    const hasStartDate = !!task.start_date;
    const hasDueDate = !!task.due_date;

    if (!hasStartDate || !hasDueDate) {
    }

    return hasStartDate && hasDueDate;
  });


  return filtered.map(task => {
      // Calculate progress based on status
      let progress = 0;
      switch (task.status) {
        case 'done':
          progress = 100;
          break;
        case 'in_progress':
          progress = 50;
          break;
        case 'in_review':
          progress = 75;
          break;
        default:
          progress = 0;
      }

      // Extract dependencies
      const dependencies = task.task_dependencies
        ? task.task_dependencies
            .filter(dep => dep.depends_on_task_id)
            .map(dep => dep.depends_on_task_id.toString())
            .join(',')
        : '';


      // Note: assigned_to is just a UUID, we don't join user data
      // Display name would need to be fetched separately if needed
      const assignee = task.assigned_to ? 'Assigned' : null;

      // Build custom class for styling
      const customClass = [
        `priority-${task.priority || 'medium'}`,
        `status-${task.status || 'todo'}`,
        task.is_overdue ? 'overdue' : ''
      ].filter(Boolean).join(' ');

      const ganttTask = {
        id: task.id.toString(),
        name: task.title,
        start: formatDateForGantt(task.start_date),
        end: formatDateForGantt(task.due_date),
        progress,
        dependencies,
        custom_class: customClass,
        // Store original task data for reference
        _taskId: task.id,
        _status: task.status,
        _priority: task.priority,
        assignee
      };

      return ganttTask;
    });
}

/**
 * Change Gantt view mode
 * @param {string} mode - View mode (Day, Week, Month, Year)
 */
export function changeViewMode(mode) {
  if (ganttInstance && ganttInstance.change_view_mode) {
    ganttInstance.change_view_mode(mode);
    currentOptions.viewMode = mode;
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

// ========================================
// Utility Functions
// ========================================

/**
 * Format date for Frappe Gantt (YYYY-MM-DD)
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date
 */
function formatDateForGantt(date) {
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
function formatDate(date) {
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

// ========================================
// Export all functions
// ========================================

export default {
  initGanttChart,
  transformTasksForGantt,
  changeViewMode,
  highlightCriticalPath,
  refreshGantt,
  destroyGanttChart,
  getGanttInstance,
  calculateDuration,
  validateTaskDates,
  getDisplayableTasks,
  getMissingDatesTasks
};
