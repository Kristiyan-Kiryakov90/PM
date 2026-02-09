/**
 * Tasks Page Logic
 * Main coordinator for task operations, views, and real-time updates
 * Refactored from 2,445 lines into modular architecture
 */

import { Modal } from 'bootstrap';
import { renderNavbar } from '../components/navbar.js';
import { requireAuth } from '../utils/router.js';
import { getCurrentUser } from '../utils/auth.js';
import { showError } from '../utils/ui-helpers.js';
import { getTasks } from '../services/task-service.js';
import { getProjects } from '../services/project-service.js';
import { getTags } from '../services/tag-service.js';
import { getTaskTags } from '../services/tag-service.js';
import { subscribeToTasks, unsubscribeAll } from '../services/realtime-service.js';
import { changeViewMode } from '../components/gantt-chart.js';

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
let statuses = []; // Dynamic statuses for current project
let currentFilters = {
  project_id: '',
  status: '',
  tag_id: '',
  search: '',
};
let currentUser = null;
let realtimeSubscriptionId = null;
let currentView = 'kanban'; // 'kanban', 'list', 'gantt'

/**
 * Initialize the tasks page
 */
async function init() {
  try {
    // Require authentication
    await requireAuth();

    // Render navbar
    await renderNavbar();

    // Load current user
    currentUser = await getCurrentUser();

    // Initialize modules with user context
    initAttachmentModule(currentUser);
    initModalsModule(currentUser);

    // Load projects for filter/form dropdowns
    await loadProjects();

    // Load tags for filter dropdown
    await loadTags();

    // Load tasks
    await loadTasks();

    // Setup event listeners
    setupEventListeners();

    // Subscribe to real-time updates
    await setupRealtimeSubscription();
  } catch (error) {
    console.error('Tasks page initialization error:', error);
    showError('Failed to load tasks page. Please refresh.');
  }
}

/**
 * Load projects from the API
 */
async function loadProjects() {
  try {
    projects = await getProjects();
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
    tags = await getTags();
    populateTagFilter();
  } catch (error) {
    console.error('Error loading tags:', error);
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
 * Load tasks from the API
 */
async function loadTasks() {
  try {
    const filters = {};
    if (currentFilters.project_id) filters.project_id = currentFilters.project_id;
    if (currentFilters.status) filters.status = currentFilters.status;

    tasks = await getTasks(filters);

    // Load tags for each task
    await Promise.all(
      tasks.map(async (task) => {
        task.tags = await getTaskTags(task.id);
      })
    );

    // Render appropriate view
    if (currentView === 'gantt') {
      await loadGanttView(tasks, currentFilters, openViewModal);
    } else if (currentView === 'list') {
      renderListView(tasks, currentFilters);
    } else {
      const loadedStatuses = await renderKanbanBoard(
        tasks,
        projects,
        currentFilters,
        openEditModal,
        openViewModal,
        handleChangeTaskStatus
      );
      if (loadedStatuses) {
        statuses = loadedStatuses;
      }
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    showError('Failed to load tasks. Please try again.');
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
  const filterProject = document.getElementById('filterProject');
  const filterTag = document.getElementById('filterTag');
  const searchTasks = document.getElementById('searchTasks');

  if (filterStatus) {
    filterStatus.addEventListener('change', () => {
      currentFilters.status = filterStatus.value;
      loadTasks();
    });
  }

  if (filterProject) {
    filterProject.addEventListener('change', () => {
      currentFilters.project_id = filterProject.value;
      loadTasks();
    });
  }

  if (filterTag) {
    filterTag.addEventListener('change', () => {
      currentFilters.tag_id = filterTag.value;
      // Re-render current view without API call for tag filter
      if (currentView === 'kanban') {
        renderKanbanBoard(
          tasks,
          projects,
          currentFilters,
          openEditModal,
          openViewModal,
          handleChangeTaskStatus
        );
      } else if (currentView === 'list') {
        renderListView(tasks, currentFilters);
      }
    });
  }

  if (searchTasks) {
    let searchTimeout;
    searchTasks.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = searchTasks.value;
        // Re-render current view without API call for search
        if (currentView === 'kanban') {
          renderKanbanBoard(
            tasks,
            projects,
            currentFilters,
            openEditModal,
            openViewModal,
            handleChangeTaskStatus
          );
        } else if (currentView === 'list') {
          renderListView(tasks, currentFilters);
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
      handleAddDependencyClick(currentEditingTaskId, tasks);
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

  // Setup modal listeners
  setupModalListeners(loadTasks);

  // Expose Gantt reorder functions
  exposeGanttFunctions(currentFilters, () => loadGanttView(tasks, currentFilters, openViewModal));
}

/**
 * Switch between different view modes
 */
async function switchView(view) {
  console.log(`🔄 Switching view from "${currentView}" to "${view}"`);
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
      renderListView(tasks, currentFilters);
    } else {
      const loadedStatuses = await renderKanbanBoard(
        tasks,
        projects,
        currentFilters,
        openEditModal,
        openViewModal,
        handleChangeTaskStatus
      );
      if (loadedStatuses) {
        statuses = loadedStatuses;
      }
    }

    console.log(`✅ ${view} view loaded`);
  } catch (error) {
    console.error(`Error loading ${view} view:`, error);
    showError(`Failed to load ${view} view`);
  }
}

/**
 * Setup realtime subscription
 */
async function setupRealtimeSubscription() {
  try {
    realtimeSubscriptionId = await subscribeToTasks(
      // On insert
      (newTask) => {
        console.log('New task added:', newTask);
        loadTasks(); // Reload to get full task data with relations
      },
      // On update
      (updatedTask, oldTask) => {
        console.log('Task updated:', updatedTask);
        loadTasks(); // Reload to get full task data
      },
      // On delete
      (deletedTask) => {
        console.log('Task deleted:', deletedTask);
        loadTasks(); // Reload
      }
    );
  } catch (error) {
    console.error('Error setting up realtime subscription:', error);
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  unsubscribeAll();
});

// Initialize on page load
init();
