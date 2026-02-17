/**
 * Tasks Page - Filters Module
 * Handles filter event listeners and filter application
 */

import { renderKanbanBoard } from './tasks-kanban.js';
import { renderListView } from './tasks-list.js';
import { loadGanttView } from './tasks-gantt.js';
import { populateStatusFilter } from './tasks-init.js';

/**
 * Setup filter event listeners
 */
export function setupFilterListeners(
  currentFilters,
  loadTasks,
  tasks,
  projects,
  openEditModal,
  openViewModal,
  handleChangeTaskStatus,
  trackLocalUpdate,
  getCurrentView
) {
  // Filters
  const filterStatus = document.getElementById('filterStatus');
  const filterPriority = document.getElementById('filterPriority');
  const filterProject = document.getElementById('filterProject');
  const filterTag = document.getElementById('filterTag');
  const filterAssignee = document.getElementById('filterAssignee');
  const searchTasks = document.getElementById('searchTasks');

  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      currentFilters.status = filterStatus.value;
      loadTasks();
    });
  }

  if (filterPriority) {
    filterPriority.addEventListener('change', async () => {
      currentFilters.priority = filterPriority.value;
      const currentView = getCurrentView();
      // Re-render current view without API call for priority filter
      if (currentView === 'kanban') {
        renderKanbanBoard(
          tasks,
          projects,
          currentFilters,
          openEditModal,
          openViewModal,
          handleChangeTaskStatus,
          trackLocalUpdate
        );
      } else if (currentView === 'list') {
        await renderListView(tasks, currentFilters);
      } else if (currentView === 'gantt') {
        await loadGanttView(tasks, currentFilters, openViewModal);
      }
    });
  }

  if (filterProject) {
    filterProject.addEventListener('change', async () => {
      currentFilters.project_id = filterProject.value;
      // Update status filter based on selected project
      await populateStatusFilter(filterProject.value);
      loadTasks();
    });
  }

  if (filterTag) {
    filterTag.addEventListener('change', async () => {
      currentFilters.tag_id = filterTag.value;
      const currentView = getCurrentView();
      // Re-render current view without API call for tag filter
      if (currentView === 'kanban') {
        renderKanbanBoard(
          tasks,
          projects,
          currentFilters,
          openEditModal,
          openViewModal,
          handleChangeTaskStatus,
          trackLocalUpdate
        );
      } else if (currentView === 'list') {
        await renderListView(tasks, currentFilters);
      }
    });
  }

  if (filterAssignee) {
    filterAssignee.addEventListener('change', async () => {
      currentFilters.assigned_to = filterAssignee.value;
      const currentView = getCurrentView();
      // Re-render current view without API call for assignee filter
      if (currentView === 'kanban') {
        renderKanbanBoard(
          tasks,
          projects,
          currentFilters,
          openEditModal,
          openViewModal,
          handleChangeTaskStatus,
          trackLocalUpdate
        );
      } else if (currentView === 'list') {
        await renderListView(tasks, currentFilters);
      } else if (currentView === 'gantt') {
        await loadGanttView(tasks, currentFilters, openViewModal);
      }
    });
  }

  if (searchTasks) {
    let searchTimeout;
    searchTasks.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        currentFilters.search = searchTasks.value;
        const currentView = getCurrentView();
        // Re-render current view without API call for search
        if (currentView === 'kanban') {
          renderKanbanBoard(
            tasks,
            projects,
            currentFilters,
            openEditModal,
            openViewModal,
            handleChangeTaskStatus,
            trackLocalUpdate
          );
        } else if (currentView === 'list') {
          await renderListView(tasks, currentFilters);
        }
      }, 300);
    });
  }
}
