/**
 * Task Gantt View Module
 * Handles Gantt chart rendering, drag-and-drop, and scheduling
 */

import supabase from '../services/supabase.js';
import { taskService } from "../services/task-service.js"';
import {
  initGanttChart,
  changeViewMode,
  highlightCriticalPath,
  destroyGanttChart,
  getMissingDatesTasks,
} from '../components/gantt-chart.js';
import {
  getGanttTasks,
  getCriticalPath,
  autoScheduleTasks,
  updateTaskDates,
  moveTaskUp,
  moveTaskDown,
  rebuildAutoDependencies,
} from '../services/gantt-service.js';
import { showError, showSuccess, showLoading, hideLoading } from '../utils/ui-helpers.js';

// Gantt state
let ganttInstance = null;
let isLoadingGantt = false; // Prevent infinite loops
let ganttSortOrder = 'gantt_position'; // Default sort order

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

    // Check if Frappe Gantt is loaded
    if (typeof Gantt === 'undefined') {
      showError('Gantt chart library failed to load. Please refresh the page.');
      isLoadingGantt = false;
      return;
    }

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
          const result = await updateTaskDates(parseInt(task.id), {
            start_date: start.toISOString(),
            due_date: end.toISOString(),
          });

          showSuccess(`Task dates updated: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);

          // Update local tasks array without full reload
          const taskIndex = tasks.findIndex(t => t.id === parseInt(task.id));
          if (taskIndex !== -1) {
            tasks[taskIndex].start_date = start.toISOString();
            tasks[taskIndex].due_date = end.toISOString();
          }
        } catch (error) {
          console.error('Error updating task dates:', error);
          showError('Failed to update task dates: ' + error.message);
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
          ? `${missingCount} task(s) need start date and due date. Click "Auto-Schedule" to populate dates automatically.`
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
    showError('Failed to load Gantt view');
  }
}

/**
 * Add vertical drag-and-drop reordering to Gantt task bars.
 * Click on a task bar -> card follows your mouse in real time -> release to drop.
 */
function addTaskBarReorderControls(currentFilters, reloadGanttView) {
  setTimeout(() => {
    const ganttContainer = document.querySelector('.gantt');
    if (!ganttContainer) return;

    // Cleanup previous listeners
    if (ganttContainer._ganttDragCleanup) {
      ganttContainer._ganttDragCleanup();
    }

    let drag = null; // null when not dragging

    function cleanup() {
      if (!drag) return;
      // Restore original bar
      drag.bar.style.opacity = '';
      drag.bar.classList.remove('gantt-dragging-source');
      // Remove ghost and indicator
      if (drag.ghost) drag.ghost.remove();
      if (drag.indicator) drag.indicator.remove();
      // Remove highlights
      ganttContainer.querySelectorAll('.bar-wrapper').forEach(b => {
        b.classList.remove('gantt-drop-above', 'gantt-drop-below');
      });
      ganttContainer.classList.remove('gantt-reordering');
      document.body.classList.remove('gantt-dragging-active');
      drag = null;
    }

    /**
     * Build an HTML ghost div that looks like the Gantt bar.
     * SVG <g> elements can't render outside <svg>, so we create a real HTML element.
     */
    function createGhost(barWrapper) {
      const barEl = barWrapper.querySelector('.bar');
      const labelEl = barWrapper.querySelector('.bar-label');
      const progressEl = barWrapper.querySelector('.bar-progress');
      const wrapperRect = barWrapper.getBoundingClientRect();

      // Read the fill color from SVG
      let bgColor = '#3b82f6';
      if (barEl) {
        const fill = barEl.getAttribute('fill') || window.getComputedStyle(barEl).fill;
        if (fill && fill !== 'none') bgColor = fill;
      }

      // Read progress fill
      let progressWidth = 0;
      if (progressEl && barEl) {
        try {
          const progW = parseFloat(progressEl.getAttribute('width') || 0);
          const barW = parseFloat(barEl.getAttribute('width') || 1);
          progressWidth = (progW / barW) * 100;
        } catch (_) {}
      }

      const taskName = labelEl ? labelEl.textContent.trim() : '';

      const ghost = document.createElement('div');
      ghost.id = 'gantt-drag-ghost';
      ghost.innerHTML = `
        <div class="gantt-ghost-progress" style="width:${progressWidth}%"></div>
        <span class="gantt-ghost-label">${taskName}</span>
      `;
      ghost.style.cssText = `
        position: fixed;
        left: ${wrapperRect.left}px;
        top: ${wrapperRect.top}px;
        width: ${wrapperRect.width}px;
        height: ${Math.max(wrapperRect.height, 30)}px;
        background: ${bgColor};
        border-radius: 4px;
        pointer-events: none;
        z-index: 999999;
        opacity: 0.92;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.3);
        overflow: hidden;
        box-sizing: border-box;
        transform: scale(1.03);
        will-change: top;
      `;
      document.body.appendChild(ghost);
      return ghost;
    }

    // --- MOUSE DOWN ---
    function onMouseDown(e) {
      if (e.button !== 0) return;
      const barWrapper = e.target.closest('.bar-wrapper');
      if (!barWrapper) return;
      // Don't steal resize handles
      if (e.target.closest('.handle')) return;

      const rect = barWrapper.getBoundingClientRect();
      drag = {
        bar: barWrapper,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        ghost: null,
        indicator: null,
        target: null,
        insertBefore: true,
        active: false,   // becomes true after threshold
        decided: false,
      };
    }

    // --- MOUSE MOVE ---
    function onMouseMove(e) {
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);

      // Decide vertical vs horizontal once
      if (!drag.decided && (dx > 6 || dy > 6)) {
        drag.decided = true;
        if (dy > dx) {
          // Vertical — we own this drag
          drag.active = true;
        } else {
          // Horizontal — let Frappe Gantt handle dates
          drag = null;
          return;
        }
      }

      if (!drag.active) return;

      e.preventDefault();
      e.stopPropagation();

      // First frame of active drag: create ghost + indicator
      if (!drag.ghost) {
        drag.ghost = createGhost(drag.bar);
        // Create indicator line
        const ind = document.createElement('div');
        ind.className = 'gantt-drag-indicator';
        ganttContainer.appendChild(ind);
        drag.indicator = ind;
        // Dim original
        drag.bar.style.opacity = '0.15';
        drag.bar.classList.add('gantt-dragging-source');
        ganttContainer.classList.add('gantt-reordering');
        document.body.classList.add('gantt-dragging-active');
      }

      // --- Move ghost to follow cursor exactly ---
      drag.ghost.style.top = (e.clientY - drag.offsetY) + 'px';

      // --- Find closest bar to cursor ---
      const allBars = ganttContainer.querySelectorAll('.bar-wrapper');
      let bestBar = null;
      let bestDist = Infinity;
      let above = true;

      allBars.forEach(bar => {
        if (bar === drag.bar) return;
        const r = bar.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const d = Math.abs(e.clientY - mid);
        if (d < bestDist) {
          bestDist = d;
          bestBar = bar;
          above = e.clientY < mid;
        }
      });

      // Clear old highlights
      allBars.forEach(b => b.classList.remove('gantt-drop-above', 'gantt-drop-below'));

      if (bestBar) {
        drag.target = bestBar;
        drag.insertBefore = above;

        // Position the indicator line
        const tr = bestBar.getBoundingClientRect();
        const cr = ganttContainer.getBoundingClientRect();
        const y = above
          ? (tr.top - cr.top + ganttContainer.scrollTop - 2)
          : (tr.bottom - cr.top + ganttContainer.scrollTop + 2);
        drag.indicator.style.top = y + 'px';
        drag.indicator.style.display = 'block';

        bestBar.classList.add(above ? 'gantt-drop-above' : 'gantt-drop-below');
      }
    }

    // --- MOUSE UP ---
    async function onMouseUp() {
      if (!drag) return;

      if (drag.active && drag.target) {
        const draggedId = parseInt(drag.bar.getAttribute('data-id'));
        const targetId = parseInt(drag.target.getAttribute('data-id'));
        const before = drag.insertBefore;
        cleanup();
        if (draggedId && targetId && draggedId !== targetId) {
          await reorderTaskNear(draggedId, targetId, before, currentFilters, reloadGanttView);
          return;
        }
      }

      cleanup();
    }

    // Attach
    ganttContainer.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, { capture: true });
    document.addEventListener('mouseup', onMouseUp);

    ganttContainer._ganttDragCleanup = () => {
      ganttContainer.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, 300);
}

/**
 * Reorder task near another task, update positions, rebuild auto-dependencies
 */
async function reorderTaskNear(movedTaskId, targetTaskId, insertBefore, currentFilters, reloadGanttView) {
  try {
    if (!currentFilters.project_id) {
      showError('Project must be selected');
      return;
    }

    showLoading('Reordering...');

    // Get all tasks sorted by current gantt_position
    const filters = { project_id: currentFilters.project_id, sort_by: 'gantt_position' };
    const allTasks = await getGanttTasks(filters);

    const movedIndex = allTasks.findIndex(t => t.id === movedTaskId);
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);

    if (movedIndex === -1 || targetIndex === -1) {
      hideLoading();
      return;
    }

    // Reorder array
    const [movedTask] = allTasks.splice(movedIndex, 1);
    let newTargetIndex;
    if (insertBefore) {
      newTargetIndex = movedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    } else {
      newTargetIndex = movedIndex < targetIndex ? targetIndex : targetIndex + 1;
    }
    allTasks.splice(newTargetIndex, 0, movedTask);

    // Update all gantt_positions in parallel
    const promises = allTasks.map((task, index) =>
      supabase
        .from('tasks')
        .update({ gantt_position: index + 1 })
        .eq('id', task.id)
    );
    await Promise.all(promises);

    // Rebuild auto-dependencies based on new order
    try {
      const depResult = await rebuildAutoDependencies(currentFilters.project_id);
      hideLoading();
      showSuccess(`Task reordered — ${depResult.created} dependencies updated`);
    } catch (depError) {
      hideLoading();
      console.error('Error rebuilding dependencies:', depError);
      showSuccess('Task reordered (dependencies failed to update)');
    }

    // Reload the gantt chart
    await reloadGanttView();
  } catch (error) {
    hideLoading();
    console.error('Error reordering:', error);
    showError('Failed to reorder task');
  }
}

/**
 * Handle show critical path button click
 */
export async function handleShowCriticalPath(currentFilters) {
  try {
    if (!currentFilters.project_id) {
      showError('Select a project to view critical path');
      return;
    }

    showLoading('Calculating critical path...');
    const criticalTasks = await getCriticalPath(currentFilters.project_id);
    hideLoading();

    if (criticalTasks.length === 0) {
      showSuccess('No critical path found. All tasks have scheduling flexibility.');
      return;
    }

    const criticalTaskIds = criticalTasks.map(t => t.task_id);
    highlightCriticalPath(criticalTaskIds);

    showSuccess(`Critical path: ${criticalTasks.length} task(s) highlighted`);
  } catch (error) {
    hideLoading();
    console.error('Error showing critical path:', error);
    showError('Failed to calculate critical path');
  }
}

/**
 * Handle auto-schedule button click
 */
export async function handleAutoSchedule(currentFilters, reloadTasks) {
  try {
    console.log('⚙️ Auto-schedule button clicked');

    if (!currentFilters.project_id) {
      console.error('❌ No project selected');
      showError('Select a project to auto-schedule');
      return;
    }

    console.log('🔄 Calling autoScheduleTasks for project:', currentFilters.project_id);
    showLoading('Auto-scheduling tasks...');
    const result = await autoScheduleTasks(currentFilters.project_id);
    hideLoading();

    console.log('✅ Auto-schedule result:', result);

    if (result.updated === 0) {
      showSuccess('All tasks already have schedules');
    } else {
      showSuccess(`Auto-scheduled ${result.updated} task(s)`);
    }

    // Reload tasks
    console.log('🔄 Reloading tasks after auto-schedule...');
    await reloadTasks();
  } catch (error) {
    hideLoading();
    console.error('❌ Error auto-scheduling:', error);
    showError('Failed to auto-schedule tasks');
  }
}

/**
 * Expose Gantt reorder functions to window for popup buttons
 */
export function exposeGanttFunctions(currentFilters, reloadGanttView) {
  window.moveGanttTaskUp = async function(taskId) {
    console.log('🔵 moveGanttTaskUp called with taskId:', taskId);

    try {
      const id = parseInt(taskId);
      console.log('📝 Parsed task ID:', id);
      console.log('📝 Current project filter:', currentFilters.project_id);

      if (!currentFilters.project_id) {
        console.error('❌ No project selected!');
        showError('Project must be selected to reorder tasks');
        return;
      }

      console.log('⬆️ Calling moveTaskUp...');
      await moveTaskUp(id, currentFilters.project_id);
      console.log('✅ moveTaskUp completed');

      showSuccess('Task moved up');

      // Reload Gantt to show new order
      console.log('🔄 Reloading Gantt view...');
      await reloadGanttView();
      console.log('✅ Gantt view reloaded');
    } catch (error) {
      console.error('❌ Error in moveGanttTaskUp:', error);
      showError('Failed to move task: ' + error.message);
    }
  };

  window.moveGanttTaskDown = async function(taskId) {
    console.log('🔵 moveGanttTaskDown called with taskId:', taskId);

    try {
      const id = parseInt(taskId);
      console.log('📝 Parsed task ID:', id);
      console.log('📝 Current project filter:', currentFilters.project_id);

      if (!currentFilters.project_id) {
        console.error('❌ No project selected!');
        showError('Project must be selected to reorder tasks');
        return;
      }

      console.log('⬇️ Calling moveTaskDown...');
      await moveTaskDown(id, currentFilters.project_id);
      console.log('✅ moveTaskDown completed');

      showSuccess('Task moved down');

      // Reload Gantt to show new order
      console.log('🔄 Reloading Gantt view...');
      await reloadGanttView();
      console.log('✅ Gantt view reloaded');
    } catch (error) {
      console.error('❌ Error in moveGanttTaskDown:', error);
      showError('Failed to move task: ' + error.message);
    }
  };

  console.log('✅ Gantt reorder functions registered on window object');
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
