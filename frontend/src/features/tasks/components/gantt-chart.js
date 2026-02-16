import { ganttService } from '@services/gantt-service.js';
import { teamService } from '@services/team-service.js';

/**
 * Gantt Chart Component - Integrates Frappe Gantt library
 */

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


    let tasks = await ganttService.getGanttTasks(filters);

    // Apply client-side filters for priority and assignee
    if (currentOptions.priority) {
      tasks = tasks.filter(task => task.priority === currentOptions.priority);
    }
    if (currentOptions.assigned_to) {
      tasks = tasks.filter(task => task.assigned_to === currentOptions.assigned_to);
    }
    if (currentOptions.tag_id) {
      const tagId = parseInt(currentOptions.tag_id, 10);
      tasks = tasks.filter(task => task.tags && task.tags.some(tag => tag.id === tagId));
    }

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
        // Re-add today marker when view changes
        setTimeout(() => {
          hideDefaultTodayMarker();
          addCustomTodayMarker();

          // Show week numbers in week view
          if (mode === 'Week') {
            updateWeekViewHeaders();
          }
        }, 100);
      }
    });

    // Hide default today marker and add custom one
    setTimeout(() => {
      hideDefaultTodayMarker();
      addCustomTodayMarker();
      scrollToToday();
    }, 100);

    return ganttInstance;
  } catch (error) {
    console.error('Error initializing Gantt chart:', error);
    throw error;
  }
}

/**
 * Scroll Gantt chart to today's date
 */
function scrollToToday() {
  if (!ganttInstance) return;

  try {
    const container = ganttInstance.$container;
    if (!container) return;

    // Look for our custom today marker
    const customMarker = container.querySelector('.custom-today-marker');

    if (customMarker) {
      // Get the x position from our custom marker
      const todayX = parseFloat(customMarker.getAttribute('x1') || 0);

      // Find the grid scroll container
      const gridScroll = container.querySelector('.gantt-container');
      if (gridScroll) {
        // Scroll to center today's marker in the view
        const centerOffset = gridScroll.clientWidth / 2;
        gridScroll.scrollLeft = Math.max(0, todayX - centerOffset);
        console.log('📜 Scrolled to position:', gridScroll.scrollLeft);
      }
    } else {
      console.log('⚠️ Custom today marker not found, using fallback');
      // Fallback: Calculate based on date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDate = new Date(ganttInstance.gantt_start);
      startDate.setHours(0, 0, 0, 0);

      // Calculate days difference
      const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

      // Get column width from gantt instance
      const columnWidth = ganttInstance.options.column_width || 30;
      const scrollPos = daysDiff * columnWidth;

      const gridScroll = container.querySelector('.gantt-container');
      if (gridScroll) {
        gridScroll.scrollLeft = Math.max(0, scrollPos - (gridScroll.clientWidth / 2));
      }
    }
  } catch (error) {
    console.error('Error scrolling to today:', error);
  }
}

/**
 * Hide default Frappe Gantt today marker (may use wrong timezone)
 */
function hideDefaultTodayMarker() {
  if (!ganttInstance) return;

  try {
    const container = ganttInstance.$container;
    if (!container) return;

    // Hide all default today highlights
    const todayHighlights = container.querySelectorAll('.today-highlight');
    todayHighlights.forEach(element => {
      element.style.display = 'none';
    });
  } catch (error) {
    console.error('Error hiding default today marker:', error);
  }
}

/**
 * Add custom today marker at correct local date position
 */
function addCustomTodayMarker() {
  if (!ganttInstance) return;

  try {
    const container = ganttInstance.$container;
    if (!container) return;

    // Remove any existing custom markers first
    const existingMarkers = container.querySelectorAll('.custom-today-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Get today's date in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('📅 Today (local):', today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }));

    // Get chart start date
    const startDate = new Date(ganttInstance.gantt_start);
    startDate.setHours(0, 0, 0, 0);

    console.log('📊 Chart starts:', startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));

    // Get current view mode
    const viewMode = currentOptions.viewMode || 'Day';
    console.log('👁️ Current view mode:', viewMode);

    // Calculate days from start to today
    const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    console.log('📏 Days from start to today:', daysDiff);

    if (daysDiff < 0) {
      console.log('⚠️ Today is before chart start date');
      return;
    }

    // Calculate X position based on view mode
    const columnWidth = ganttInstance.options.column_width || 30;
    let xPosition;

    // Adjust calculation based on view mode
    switch(viewMode) {
      case 'Week':
        // In week view, each column is a week, so we need to find which week contains today
        const weekIndex = Math.floor(daysDiff / 7);
        xPosition = weekIndex * columnWidth;
        break;
      case 'Month':
        // In month view, each column is a month
        const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 +
                          (today.getMonth() - startDate.getMonth());
        xPosition = monthsDiff * columnWidth;
        break;
      default:
        // Day view - direct calculation
        xPosition = daysDiff * columnWidth;
    }

    console.log('📍 Today marker X position:', xPosition, '(view:', viewMode + ')');

    // Find the SVG element
    const svg = container.querySelector('svg');
    if (!svg) {
      console.error('SVG element not found');
      return;
    }

    // Get SVG height
    const svgHeight = parseFloat(svg.getAttribute('height') || 0);

    // Create custom today line (very thin, subtle red vertical line)
    const todayLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    todayLine.setAttribute('x1', xPosition);
    todayLine.setAttribute('y1', '0');
    todayLine.setAttribute('x2', xPosition);
    todayLine.setAttribute('y2', svgHeight);
    todayLine.setAttribute('stroke', '#dc2626');
    todayLine.setAttribute('stroke-width', '0.5');
    todayLine.setAttribute('opacity', '0.5');
    todayLine.setAttribute('class', 'custom-today-marker');
    todayLine.style.pointerEvents = 'none';

    // Add to SVG
    svg.appendChild(todayLine);

    console.log('✅ Custom today marker added for', viewMode, 'view');
  } catch (error) {
    console.error('Error adding custom today marker:', error);
  }
}

/**
 * Get progress percentage based on task status
 * @param {string} status - Task status
 * @returns {number} Progress percentage (0-100)
 */
function getStatusBasedProgress(status) {
  switch (status) {
    case 'done':
      return 100;
    case 'in_progress':
      return 50;
    case 'in_review':
      return 75;
    default:
      return 0;
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
      // Calculate progress based on checklist completion
      let progress = 0;

      // Check if task has checklists
      if (task.checklists && task.checklists.length > 0) {
        let totalItems = 0;
        let completedItems = 0;

        // Count all items across all checklists
        task.checklists.forEach(checklist => {
          if (checklist.checklist_items && checklist.checklist_items.length > 0) {
            totalItems += checklist.checklist_items.length;
            completedItems += checklist.checklist_items.filter(item => item.is_completed).length;
          }
        });

        // Calculate percentage
        if (totalItems > 0) {
          progress = Math.round((completedItems / totalItems) * 100);
        } else {
          // Checklist exists but no items - 0% unless done
          progress = task.status === 'done' ? 100 : 0;
        }
      } else {
        // No checklists - 0% progress unless task is done
        progress = task.status === 'done' ? 100 : 0;
      }

      // Extract dependencies
      const dependencies = task.task_dependencies
        ? task.task_dependencies
            .filter(dep => dep.depends_on_task_id)
            .map(dep => dep.depends_on_task_id.toString())
            .join(',')
        : '';


      // Get assignee name from cached team members
      let assignee = null;
      if (task.assigned_to) {
        const assigneeMember = cachedTeamMembers.find(m => m.id === task.assigned_to);
        assignee = assigneeMember?.full_name || assigneeMember?.email || 'Unknown';
      }

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
        assignee // Only shown in popup
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

    // Re-add today marker after view mode change (longer timeout for re-render)
    setTimeout(() => {
      hideDefaultTodayMarker();
      addCustomTodayMarker();

      // Show week numbers in week view
      if (mode === 'Week') {
        updateWeekViewHeaders();
      }
    }, 300);
  }
}

/**
 * Get ISO week number for a date
 * @param {Date} date - The date
 * @returns {number} Week number (1-53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Update Gantt headers to show week numbers in week view
 */
function updateWeekViewHeaders() {
  if (!ganttInstance) return;

  try {
    const container = ganttInstance.$container;
    if (!container) return;

    console.log('📅 Updating week view headers to show week numbers');

    // Find all header text elements
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Get the start date
    const startDate = new Date(ganttInstance.gantt_start);

    // Find all upper header text elements (these show the dates)
    const upperHeaders = svg.querySelectorAll('.upper-text');

    upperHeaders.forEach((header, index) => {
      // Calculate the date for this header
      const weekDate = new Date(startDate);
      weekDate.setDate(startDate.getDate() + (index * 7));

      // Get week number
      const weekNum = getWeekNumber(weekDate);
      const year = weekDate.getFullYear();

      // Update the text to show week number
      header.textContent = `Week ${weekNum}, ${year}`;
    });

    // Also update lower headers if they exist
    const lowerHeaders = svg.querySelectorAll('.lower-text');

    lowerHeaders.forEach((header, index) => {
      // Calculate the date for this header
      const weekDate = new Date(startDate);
      weekDate.setDate(startDate.getDate() + (index * 7));

      // Get week number
      const weekNum = getWeekNumber(weekDate);

      // Show just the week number
      header.textContent = `W${weekNum}`;
    });

    console.log('✅ Week view headers updated');
  } catch (error) {
    console.error('Error updating week view headers:', error);
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
