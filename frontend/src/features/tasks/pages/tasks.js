/**
 * Tasks Page - Main Coordinator
 * Orchestrates task operations, views, and state management
 * Refactored into modular architecture
 */

// Import styles
import '@styles/global/global.css';
import '@styles/shared/navbar.css';
import '@styles/shared/notifications.css';
import '@tasks/styles/tasks.css';
import '@tasks/styles/comments.css';
import '@styles/shared/tags.css';

import { Modal } from 'bootstrap';
import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { taskService } from "@services/task-service.js";
import { tagService } from '@services/tag-service.js';
import { statusService } from '@services/status-service.js';
import { changeViewMode } from '@tasks/components/gantt-chart.js';

// Import page modules
import { initAttachmentModule } from './tasks-attachments.js';
import { renderKanbanBoard, changeTaskStatus } from './tasks-kanban.js';
import { renderListView } from './tasks-list.js';
import {
  loadGanttView,
  handleShowCriticalPath,
  exposeGanttFunctions,
  getGanttSortOrder,
  setGanttSortOrder,
  cleanupGanttView,
} from './tasks-gantt.js';
import {
  initModalsModule,
  openCreateModal,
  openEditModal,
  openViewModal,
  setupModalListeners,
  getCurrentEditingTaskId,
} from './tasks-modals.js';
import {
  handleAddDependencyClick,
  handleConfirmAddDependency,
  handleRemoveDependency,
  renderTaskDependencies,
} from './tasks-dependencies.js';

// Import new modules
import {
  loadProjects,
  loadTags,
  loadTeamMembers,
  populateProjectDropdowns,
  populateTagFilter,
  populateAssigneeFilter,
  populateStatusFilter,
  populateStatusFilterFromData,
} from './tasks-init.js';
import { setupFilterListeners } from './tasks-filters.js';
import {
  setupRealtimeSubscription,
  createDebouncedReload,
  trackLocalUpdate as trackLocalUpdateRealtime,
  cleanupRealtime,
} from './tasks-realtime.js';

// State
let tasks = [];
let projects = [];
let tags = [];
let teamMembers = [];
let statuses = [];
let currentFilters = {
  project_id: '',
  status: '',
  priority: '',
  tag_id: '',
  assigned_to: '',
  search: '',
};
let currentUser = null;
let currentView = 'kanban'; // 'kanban', 'list', 'gantt'
let isLoadingTasks = false;
let ignoreRealtimeUpdates = false;

/**
 * Initialize the tasks page
 */
async function init() {
  console.time('⏱️ Tasks Page Load');
  try {
    // Require authentication
    await router.requireAuth();

    // Round 1: fire everything that doesn't need other results in parallel,
    // including an initial unfiltered task load so tasks arrive ASAP.
    const [, loadedUser, loadedProjects, loadedTags, loadedTeamMembers, fetchedTasks] = await Promise.all([
      renderNavbar(),
      authUtils.getCurrentUser(),
      loadProjects(),
      loadTags(),
      loadTeamMembers(),
      taskService.getTasks({}),
    ]);

    currentUser = loadedUser;
    projects = loadedProjects;
    tags = loadedTags;
    teamMembers = loadedTeamMembers;
    tasks = fetchedTasks;

    // Round 2: now we have task IDs and project IDs — fetch tags + statuses in parallel.
    const firstProjectId = projects.length > 0 ? projects[0].id : null;
    const [tagsByTask, fetchedStatuses] = await Promise.all([
      tagService.getTagsForTasks(tasks.map(t => t.id)),
      firstProjectId ? statusService.getProjectStatuses(firstProjectId) : Promise.resolve([]),
    ]);

    tasks.forEach(task => { task.tags = tagsByTask[task.id] || []; });
    statuses = fetchedStatuses;

    // Populate all dropdowns — sync, no DB calls
    populateProjectDropdowns(projects);
    populateTagFilter(tags);
    populateAssigneeFilter(teamMembers);
    populateStatusFilterFromData(fetchedStatuses);

    // Init modules — pass pre-loaded team members to skip the extra fetch
    initAttachmentModule(currentUser);
    initModalsModule(currentUser, teamMembers);

    // Render — no DB calls (all data is ready)
    const loadedStatuses = await renderKanbanBoard(
      tasks, projects, currentFilters,
      openEditModal, openViewModal, handleChangeTaskStatus, trackLocalUpdate,
      { preloadedStatuses: fetchedStatuses, preloadedTeamMembers: teamMembers }
    );
    if (loadedStatuses) statuses = loadedStatuses;

    // Setup event listeners and real-time
    setupEventListeners();
    const debouncedReloadTasks = createDebouncedReload(
      () => isLoadingTasks,
      loadTasksInternal
    );
    await setupRealtimeSubscription(
      () => ignoreRealtimeUpdates,
      debouncedReloadTasks
    );

    console.timeEnd('⏱️ Tasks Page Load');
  } catch (error) {
    console.error('Tasks page initialization error:', error);
    uiHelpers.showError('Failed to load tasks page. Please refresh.');
    console.timeEnd('⏱️ Tasks Page Load');
  }
}

/**
 * Load tasks from the API
 */
async function loadTasksInternal() {
  // Prevent concurrent loads
  if (isLoadingTasks) {
    console.log('⏭️ Skipping task load - already in progress');
    return;
  }

  console.log('🔄 Loading tasks...');

  try {
    isLoadingTasks = true;
    ignoreRealtimeUpdates = true; // Ignore real-time updates during manual load

    const filters = {};
    if (currentFilters.project_id) filters.project_id = currentFilters.project_id;
    if (currentFilters.status) filters.status = currentFilters.status;

    // Determine which project's statuses to fetch (same logic as renderKanbanBoard)
    const statusProjectId = currentFilters.project_id || (projects.length > 0 ? projects[0].id : null);

    // Fetch tasks and statuses in parallel
    const [fetchedTasks, fetchedStatuses] = await Promise.all([
      taskService.getTasks(filters),
      statusProjectId ? statusService.getProjectStatuses(statusProjectId) : Promise.resolve(null),
    ]);
    tasks = fetchedTasks;

    // Load tags for each task (needs task IDs, so runs after getTasks)
    const tagsByTask = await tagService.getTagsForTasks(tasks.map(t => t.id));
    tasks.forEach(task => { task.tags = tagsByTask[task.id] || []; });

    // Render appropriate view
    if (currentView === 'gantt') {
      await loadGanttView(tasks, currentFilters, openViewModal);
    } else if (currentView === 'list') {
      await renderListView(tasks, currentFilters);
    } else {
      const loadedStatuses = await renderKanbanBoard(
        tasks,
        projects,
        currentFilters,
        openEditModal,
        openViewModal,
        handleChangeTaskStatus,
        trackLocalUpdate,
        { preloadedStatuses: fetchedStatuses, preloadedTeamMembers: teamMembers }
      );
      if (loadedStatuses) {
        statuses = loadedStatuses;
      }
    }

    console.log('✅ Tasks loaded successfully');
  } catch (error) {
    console.error('Error loading tasks:', error);
    uiHelpers.showError('Failed to load tasks. Please try again.');
  } finally {
    isLoadingTasks = false;

    // Re-enable real-time updates after a short delay
    setTimeout(() => {
      ignoreRealtimeUpdates = false;
      console.log('✅ Real-time updates re-enabled');
    }, 1000);
  }
}

/**
 * Handle task status change (wrapper for kanban module)
 * Optimistic: update local state + DB only — no full reload/re-render.
 */
async function handleChangeTaskStatus(taskId, newStatus) {
  // Update the local tasks array immediately so any later render uses fresh data
  const id = parseInt(taskId, 10);
  const task = tasks.find(t => t.id === id);
  const previousStatus = task?.status;
  if (task) task.status = newStatus;

  // Prevent the real-time echo from triggering a reload
  trackLocalUpdate(taskId, newStatus);

  // Persist to DB in background — revert local cache on failure
  changeTaskStatus(taskId, newStatus).catch((err) => {
    console.error('Failed to update task status:', err);
    if (task && previousStatus) task.status = previousStatus;
  });
}

/**
 * Track a local update to prevent reload loop
 */
export function trackLocalUpdate(taskId, newStatus) {
  trackLocalUpdateRealtime(taskId, newStatus);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // New task button
  const newTaskBtn = document.getElementById('newTaskBtn');
  if (newTaskBtn) {
    newTaskBtn.addEventListener('click', openCreateModal);
  }

  // Setup filter listeners
  setupFilterListeners(
    currentFilters,
    loadTasksInternal,
    tasks,
    projects,
    openEditModal,
    openViewModal,
    handleChangeTaskStatus,
    trackLocalUpdate,
    () => currentView
  );

  // View mode toggle
  const viewModeToggle = document.querySelector('.view-mode-toggle');
  if (viewModeToggle) {
    viewModeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (btn) {
        const view = btn.dataset.view;
        switchView(view);
      }
    });
  }

  // Gantt view mode buttons (Day/Week/Month)
  const ganttControls = document.querySelector('.gantt-controls');
  if (ganttControls) {
    ganttControls.addEventListener('click', (e) => {
      const btn = e.target.closest('.gantt-view-btn');
      if (btn) {
        const mode = btn.dataset.mode;
        changeViewMode(mode);
        document.querySelectorAll('.gantt-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  }

  // Gantt sort order
  const ganttSortSelect = document.getElementById('ganttSortOrder');
  if (ganttSortSelect) {
    console.log('✅ Gantt sort dropdown found and listener attached');
    ganttSortSelect.addEventListener('change', async () => {
      const oldOrder = getGanttSortOrder();
      setGanttSortOrder(ganttSortSelect.value);
      console.log(`📊 Gantt sort order changed from "${oldOrder}" to "${ganttSortSelect.value}"`);
      if (currentView === 'gantt') {
        console.log('🔄 Reloading Gantt view with new sort order...');
        await loadGanttView(tasks, currentFilters, openViewModal);
      }
    });
  }

  // Critical path button
  const criticalPathBtn = document.getElementById('showCriticalPathBtn');
  if (criticalPathBtn) {
    criticalPathBtn.addEventListener('click', () => handleShowCriticalPath(currentFilters));
  }

  // Add dependency button
  const addDependencyBtn = document.getElementById('addDependencyBtn');
  if (addDependencyBtn) {
    addDependencyBtn.addEventListener('click', () => {
      const currentEditingTaskId = getCurrentEditingTaskId();
      handleAddDependencyClick(currentEditingTaskId);
    });
  }

  // Confirm add dependency button
  const confirmAddDependency = document.getElementById('confirmAddDependency');
  if (confirmAddDependency) {
    confirmAddDependency.addEventListener('click', () => {
      const currentEditingTaskId = getCurrentEditingTaskId();
      handleConfirmAddDependency(currentEditingTaskId, currentView, loadTasksInternal, renderTaskDependencies);
    });
  }

  // Remove dependency buttons (event delegation)
  const taskDependenciesContainer = document.getElementById('taskDependencies');
  if (taskDependenciesContainer) {
    taskDependenciesContainer.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.remove-dependency-btn');
      if (removeBtn) {
        const taskId = parseInt(removeBtn.dataset.taskId, 10);
        const dependsOnId = parseInt(removeBtn.dataset.dependsOnId, 10);
        await handleRemoveDependency(taskId, dependsOnId, currentView, loadTasksInternal, renderTaskDependencies);
      }
    });
  }

  // Setup modal listeners
  setupModalListeners(loadTasksInternal);

  // Listen for Kanban settings changes (triggered from admin panel)
  window.addEventListener('kanbanSettingsChanged', () => {
    console.log('Kanban settings changed, reloading tasks...');
    loadTasksInternal();
  });

  // Listen for task status changes from checklists
  window.addEventListener('taskStatusChanged', (event) => {
    console.log('Task status changed from checklist:', event.detail);
    loadTasksInternal();
  });

  // Expose Gantt reorder functions
  exposeGanttFunctions(currentFilters, () => loadGanttView(tasks, currentFilters, openViewModal));
}

/**
 * Switch between different view modes
 */
async function switchView(view) {
  console.log(`🔄 Switching view from "${currentView}" to "${view}"`);

  // Cleanup previous view
  if (currentView === 'gantt' && view !== 'gantt') {
    console.log('🧹 Cleaning up Gantt view...');
    cleanupGanttView();
  }

  currentView = view;

  // Update active button
  document.querySelectorAll('.view-mode-toggle button').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-view="${view}"]`);
  if (btn) btn.classList.add('active');

  // Show/hide containers
  const kanbanView = document.querySelector('.kanban-view');
  const listView = document.querySelector('.list-view');
  const ganttView = document.querySelector('.gantt-view');
  const ganttControls = document.querySelector('.gantt-controls');

  if (kanbanView) kanbanView.style.display = view === 'kanban' ? 'block' : 'none';
  if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
  if (ganttView) ganttView.style.display = view === 'gantt' ? 'block' : 'none';
  if (ganttControls) {
    ganttControls.classList.toggle('d-none', view !== 'gantt');
  }

  // Load appropriate view
  try {
    console.log(`📊 Loading ${view} view...`);
    console.log(`📋 Current tasks array has ${tasks.length} tasks`);

    if (view === 'gantt') {
      await loadGanttView(tasks, currentFilters, openViewModal);
    } else if (view === 'list') {
      await renderListView(tasks, currentFilters);
    } else {
      const loadedStatuses = await renderKanbanBoard(
        tasks,
        projects,
        currentFilters,
        openEditModal,
        openViewModal,
        handleChangeTaskStatus,
        trackLocalUpdate
      );
      if (loadedStatuses) {
        statuses = loadedStatuses;
      }
    }

    console.log(`✅ ${view} view loaded`);
  } catch (error) {
    console.error(`Error loading ${view} view:`, error);
    uiHelpers.showError(`Failed to load ${view} view`);
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  cleanupRealtime();
});

// Initialize on page load
init();
