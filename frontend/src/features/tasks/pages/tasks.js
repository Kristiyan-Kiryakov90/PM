/**
 * Tasks Page Logic
 * Main coordinator for task operations, views, and real-time updates
 * Refactored from 2,445 lines into modular architecture
 */

import { Modal } from 'bootstrap';
import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { taskService } from "@services/task-service.js";
import { projectService } from '@services/project-service.js';
import { tagService } from '@services/tag-service.js';
import { teamService } from '@services/team-service.js';
import { statusService } from '@services/status-service.js';
import { realtimeService } from '@services/realtime-service.js';
import { changeViewMode } from '@tasks/components/gantt-chart.js';

// Import modules
import { initAttachmentModule } from './tasks-attachments.js';
import { renderKanbanBoard, changeTaskStatus } from './tasks-kanban.js';
import { renderListView } from './tasks-list.js';
import {
  loadGanttView,
  handleShowCriticalPath,
  handleAutoSchedule,
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
  openDeleteModal,
  setupModalListeners,
  getCurrentEditingTaskId,
} from './tasks-modals.js';
import {
  handleAddDependencyClick,
  handleConfirmAddDependency,
  handleRemoveDependency,
  renderTaskDependencies,
} from './tasks-dependencies.js';

// State
let tasks = [];
let projects = [];
let tags = []; // All available tags
let teamMembers = []; // Team members for assignee filter
let statuses = []; // Dynamic statuses for current project
let currentFilters = {
  project_id: '',
  status: '',
  priority: '',
  tag_id: '',
  assigned_to: '',
  search: '',
};
let currentUser = null;
let realtimeSubscriptionId = null;
let currentView = 'kanban'; // 'kanban', 'list', 'gantt'
let recentLocalUpdates = new Set(); // Track recent local updates to prevent reload loops
let reloadDebounceTimer = null;
let isLoadingTasks = false; // Prevent concurrent task loads
let ignoreRealtimeUpdates = false; // Temporarily ignore real-time updates during manual operations

/**
 * Initialize the tasks page
 */
async function init() {
  try {
    // Require authentication
    await router.requireAuth();

    // Render navbar
    await renderNavbar();

    // Load current user
    currentUser = await authUtils.getCurrentUser();

    // Initialize modules with user context
    initAttachmentModule(currentUser);
    await initModalsModule(currentUser);

    // Load all data in parallel for faster page load
    await Promise.all([
      loadProjects(),
      loadTags(),
      loadTeamMembers(),
    ]);

    // Populate status filter (with default or first project)
    const firstProjectId = projects.length > 0 ? projects[0].id : null;
    await populateStatusFilter(firstProjectId);

    // Load tasks
    await loadTasks();

    // Setup event listeners
    setupEventListeners();

    // Subscribe to real-time updates
    await setupRealtimeSubscription();
  } catch (error) {
    console.error('Tasks page initialization error:', error);
    uiHelpers.showError('Failed to load tasks page. Please refresh.');
  }
}

/**
 * Load projects from the API (only active projects)
 */
async function loadProjects() {
  try {
    // Only load active projects for task assignment
    projects = await projectService.getProjects({ status: 'active' });
    populateProjectDropdowns();
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

/**
 * Load tags from the API
 */
async function loadTags() {
  try {
    tags = await tagService.getTags();
    populateTagFilter();
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

/**
 * Load team members from the API
 */
async function loadTeamMembers() {
  try {
    teamMembers = await teamService.getTeamMembers();
    populateAssigneeFilter();
  } catch (error) {
    console.error('Error loading team members:', error);
  }
}

/**
 * Populate project dropdowns
 */
function populateProjectDropdowns() {
  const filterProjectSelect = document.getElementById('filterProject');
  const taskProjectSelect = document.getElementById('taskProject');

  // Filter dropdown
  if (filterProjectSelect) {
    const currentValue = filterProjectSelect.value;
    filterProjectSelect.innerHTML = '<option value="">All Projects</option>';
    projects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      filterProjectSelect.appendChild(option);
    });
    filterProjectSelect.value = currentValue;
  }

  // Task form dropdown
  if (taskProjectSelect) {
    const currentValue = taskProjectSelect.value;
    taskProjectSelect.innerHTML = '<option value="">Select project...</option>';
    projects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      taskProjectSelect.appendChild(option);
    });
    if (currentValue) {
      taskProjectSelect.value = currentValue;
    }
  }
}

/**
 * Populate tag filter dropdown
 */
function populateTagFilter() {
  const filterTagSelect = document.getElementById('filterTag');

  if (filterTagSelect) {
    const currentValue = filterTagSelect.value;
    filterTagSelect.innerHTML = '<option value="">All Tags</option>';
    tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag.id;
      option.textContent = tag.name;
      filterTagSelect.appendChild(option);
    });
    filterTagSelect.value = currentValue;
  }
}

/**
 * Populate assignee filter dropdown
 */
function populateAssigneeFilter() {
  const filterAssigneeSelect = document.getElementById('filterAssignee');

  if (filterAssigneeSelect) {
    const currentValue = filterAssigneeSelect.value;
    filterAssigneeSelect.innerHTML = '<option value="">All Members</option>';
    teamMembers.forEach((member) => {
      const option = document.createElement('option');
      option.value = member.id;
      option.textContent = member.full_name || member.email || 'Unknown User';
      filterAssigneeSelect.appendChild(option);
    });
    filterAssigneeSelect.value = currentValue;
  }
}

/**
 * Populate status filter dropdown based on selected project
 */
async function populateStatusFilter(projectId) {
  const filterStatusSelect = document.getElementById('filterStatus');

  if (!filterStatusSelect) return;

  const currentValue = filterStatusSelect.value;
  filterStatusSelect.innerHTML = '<option value="">All Status</option>';

  if (!projectId) {
    // No project selected, show default statuses
    const defaultStatuses = [
      { slug: 'todo', name: 'To Do' },
      { slug: 'in_progress', name: 'In Progress' },
      { slug: 'review', name: 'Review' },
      { slug: 'done', name: 'Done' },
    ];
    defaultStatuses.forEach((status) => {
      const option = document.createElement('option');
      option.value = status.slug;
      option.textContent = status.name;
      filterStatusSelect.appendChild(option);
    });
  } else {
    // Load dynamic statuses for selected project
    try {
      const projectStatuses = await statusService.getProjectStatuses(projectId);
      projectStatuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.slug;
        option.textContent = status.name;
        filterStatusSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading statuses:', error);
      // Fallback to default statuses
      const defaultStatuses = [
        { slug: 'todo', name: 'To Do' },
        { slug: 'in_progress', name: 'In Progress' },
        { slug: 'review', name: 'Review' },
        { slug: 'done', name: 'Done' },
      ];
      defaultStatuses.forEach((status) => {
        const option = document.createElement('option');
        option.value = status.slug;
        option.textContent = status.name;
        filterStatusSelect.appendChild(option);
      });
    }
  }

  filterStatusSelect.value = currentValue;
}

/**
 * Load tasks from the API
 */
async function loadTasks() {
  // Prevent concurrent loads
  if (isLoadingTasks) {
    console.log('⏭️ Skipping task load - already in progress');
    return;
  }

  // Cancel any pending debounced reloads
  clearTimeout(reloadDebounceTimer);

  console.log('🔄 Loading tasks...');

  try {
    isLoadingTasks = true;
    ignoreRealtimeUpdates = true; // Ignore real-time updates during manual load

    const filters = {};
    if (currentFilters.project_id) filters.project_id = currentFilters.project_id;
    if (currentFilters.status) filters.status = currentFilters.status;

    tasks = await taskService.getTasks(filters);

    // Load tags for each task
    await Promise.all(
      tasks.map(async (task) => {
        task.tags = await tagService.getTaskTags(task.id);
      })
    );

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
        trackLocalUpdate
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

    // Re-enable real-time updates after a short delay to catch the current update
    setTimeout(() => {
      ignoreRealtimeUpdates = false;
      console.log('✅ Real-time updates re-enabled');
    }, 1000);
  }
}

/**
 * Handle task status change (wrapper for kanban module)
 */
async function handleChangeTaskStatus(taskId, newStatus) {
  await changeTaskStatus(taskId, newStatus, loadTasks);
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

  // Auto-schedule buttons
  const autoScheduleBtn = document.getElementById('autoScheduleBtn');
  const autoScheduleAllBtn = document.getElementById('autoScheduleAllBtn');

  if (autoScheduleBtn) {
    autoScheduleBtn.addEventListener('click', () => handleAutoSchedule(currentFilters, loadTasks));
  }

  if (autoScheduleAllBtn) {
    autoScheduleAllBtn.addEventListener('click', () => handleAutoSchedule(currentFilters, loadTasks));
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
      handleConfirmAddDependency(currentEditingTaskId, currentView, loadTasks, renderTaskDependencies);
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
        await handleRemoveDependency(taskId, dependsOnId, currentView, loadTasks, renderTaskDependencies);
      }
    });
  }

  // Setup modal listeners
  setupModalListeners(loadTasks);

  // Listen for Kanban settings changes (triggered from admin panel)
  window.addEventListener('kanbanSettingsChanged', () => {
    console.log('Kanban settings changed, reloading tasks...');
    loadTasks();
  });

  // Listen for task status changes from checklists
  window.addEventListener('taskStatusChanged', (event) => {
    console.log('Task status changed from checklist:', event.detail);
    // Reload tasks to show updated status on board
    loadTasks();
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
 * Setup realtime subscription
 */
async function setupRealtimeSubscription() {
  try {
    console.log('📡 Setting up tasks realtime subscription...');
    realtimeSubscriptionId = await realtimeService.subscribeToTasks(
      // On insert
      (newTask) => {
        console.log('📡 Real-time: New task added:', newTask.id, newTask.title);
        debouncedReloadTasks();
      },
      // On update
      (updatedTask, oldTask) => {
        console.log('📡 Real-time: Task updated:', updatedTask.id, updatedTask.title);

        // Ignore real-time updates during manual operations
        if (ignoreRealtimeUpdates) {
          console.log('⏭️ Ignoring real-time update during manual operation');
          return;
        }

        // Check if this was a local update (from drag-and-drop)
        const taskKey = `${updatedTask.id}-${updatedTask.status}`;
        if (recentLocalUpdates.has(taskKey)) {
          console.log('⏭️ Ignoring local update for task:', updatedTask.id);
          recentLocalUpdates.delete(taskKey);
          return;
        }

        console.log('🔄 Real-time triggering reload...');
        // Reload for updates from other users
        debouncedReloadTasks();
      },
      // On delete
      (deletedTask) => {
        console.log('📡 Real-time: Task deleted:', deletedTask.id);
        debouncedReloadTasks();
      }
    );
    console.log('✅ Tasks realtime subscription active:', realtimeSubscriptionId);
  } catch (error) {
    console.error('❌ Error setting up tasks realtime subscription:', error);
  }
}

/**
 * Debounced reload to prevent multiple rapid reloads
 */
function debouncedReloadTasks() {
  // Don't debounce if already loading
  if (isLoadingTasks) {
    console.log('⏭️ Skipping debounced reload - load already in progress');
    return;
  }

  clearTimeout(reloadDebounceTimer);
  reloadDebounceTimer = setTimeout(() => {
    loadTasks();
  }, 500); // Wait 500ms before reloading
}

/**
 * Track a local update to prevent reload loop
 */
export function trackLocalUpdate(taskId, newStatus) {
  const taskKey = `${taskId}-${newStatus}`;
  recentLocalUpdates.add(taskKey);

  // Remove from tracking after 3 seconds
  setTimeout(() => {
    recentLocalUpdates.delete(taskKey);
  }, 3000);
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  realtimeService.unsubscribeAll();
});

// Initialize on page load
init();
