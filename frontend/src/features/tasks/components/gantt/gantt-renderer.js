/**
 * Gantt Renderer Module
 * Handles rendering, transformations, and visual enhancements
 */

import { formatDateForGantt, formatDate, getWeekNumber } from './gantt-utils.js';

/**
 * Get progress percentage based on task status
 * @param {string} status - Task status slug
 * @returns {number} Progress percentage (0-100)
 */
function getStatusBasedProgress(status) {
  switch (status) {
    case 'done':
      return 100;
    case 'review':
    case 'in_review':
      return 75;
    case 'in_progress':
      return 50;
    case 'todo':
      return 0;
    default:
      // Custom status: treat slugs containing 'done'/'complet' as 100%, else 50%
      if (/done|complet/i.test(status)) return 100;
      return 25;
  }
}

/**
 * Transform TaskFlow tasks to Frappe Gantt format
 * @param {Array} tasks - TaskFlow tasks
 * @param {Array} cachedTeamMembers - Cached team members
 * @returns {Array} Frappe Gantt tasks
 */
export function transformTasksForGantt(tasks, cachedTeamMembers = []) {

  const filtered = tasks.filter(task => {
    const hasStartDate = !!task.start_date;
    const hasDueDate = !!task.due_date;

    if (!hasStartDate || !hasDueDate) {
    }

    return hasStartDate && hasDueDate;
  });


  return filtered.map(task => {
      // Calculate progress: checklists take priority; fall back to task status
      let progress = getStatusBasedProgress(task.status);

      if (task.checklists && task.checklists.length > 0) {
        let totalItems = 0;
        let completedItems = 0;

        task.checklists.forEach(checklist => {
          if (checklist.checklist_items && checklist.checklist_items.length > 0) {
            totalItems += checklist.checklist_items.length;
            completedItems += checklist.checklist_items.filter(item => item.is_completed).length;
          }
        });

        if (totalItems > 0) {
          progress = Math.round((completedItems / totalItems) * 100);
        }
        // If checklists exist but have no items, keep status-based progress
      }

      // A 'done' task is always 100% regardless of checklist state
      if (task.status === 'done') progress = 100;

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
 * Scroll Gantt chart to today's date.
 * @param {Object} ganttInstance
 * @param {string} viewMode - 'Day' | 'Week' | 'Month'
 */
export function scrollToToday(ganttInstance, viewMode = 'Day') {
  if (!ganttInstance) return;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(ganttInstance.gantt_start);
    startDate.setHours(0, 0, 0, 0);

    const columnWidth = ganttInstance.options.column_width || 30;
    let scrollPos = 0;

    switch (viewMode) {
      case 'Month': {
        const monthsDiff =
          (today.getFullYear() - startDate.getFullYear()) * 12 +
          (today.getMonth() - startDate.getMonth());
        if (monthsDiff < 0) return;
        scrollPos = monthsDiff * columnWidth;
        break;
      }
      case 'Week': {
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff < 0) return;
        scrollPos = Math.floor(daysDiff / 7) * columnWidth;
        break;
      }
      default: { // Day
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        if (daysDiff < 0) return;
        scrollPos = daysDiff * columnWidth;
      }
    }

    // Try $container first (Frappe's inner scrollable div), then its parent
    const candidates = [
      ganttInstance.$container,
      ganttInstance.$svg?.parentElement,
    ].filter(Boolean);

    for (const el of candidates) {
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = Math.max(0, scrollPos - el.clientWidth / 2);
        return;
      }
    }

    // Last resort
    if (ganttInstance.$container) {
      ganttInstance.$container.scrollLeft = Math.max(0, scrollPos - ganttInstance.$container.clientWidth / 2);
    }
  } catch (error) {
    console.error('Error scrolling to today:', error);
  }
}

/**
 * Hide default Frappe Gantt today marker (may use wrong timezone)
 */
export function hideDefaultTodayMarker(ganttInstance) {
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
export function addCustomTodayMarker(ganttInstance, viewMode = 'Day') {
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
 * Set up click-and-drag panning on the Gantt scroll container.
 * Clicking the grid background and dragging left/right scrolls the chart.
 * Does NOT interfere with task bar dragging (vertical reorder or date resize).
 */
export function setupGanttPanning(ganttInstance) {
  if (!ganttInstance) return;

  const container = ganttInstance.$container;
  if (!container) return;

  // Clean up any previous panning listeners on this container
  if (container._panCleanup) container._panCleanup();

  let isPanning = false;
  let startX = 0;
  let startScrollLeft = 0;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    // Skip if clicking on a task bar, handle, or popup
    if (e.target.closest('.bar-wrapper') || e.target.closest('.handle') || e.target.closest('.popup-wrapper')) return;

    isPanning = true;
    startX = e.clientX;
    startScrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isPanning) return;
    e.preventDefault();
    container.scrollLeft = startScrollLeft - (e.clientX - startX);
  }

  function onMouseUp() {
    if (!isPanning) return;
    isPanning = false;
    container.style.cursor = 'grab';
    container.style.userSelect = '';
  }

  container.style.cursor = 'grab';
  container.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  container._panCleanup = () => {
    container.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    container.style.cursor = '';
    container.style.userSelect = '';
  };
}

/**
 * Update Gantt headers to show week numbers in week view
 */
export function updateWeekViewHeaders(ganttInstance) {
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
