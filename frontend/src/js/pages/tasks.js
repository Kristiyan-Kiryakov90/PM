/**
 * Tasks Page Logic
 * Handles task CRUD operations, Kanban board, and real-time updates
 */

import { Modal } from 'bootstrap';
import supabase from '../services/supabase.js';
import { renderNavbar } from '../components/navbar.js';
import { requireAuth } from '../utils/router.js';
import { getCurrentUser } from '../utils/auth.js';
import {
  showError,
  showSuccess,
  showLoading,
  hideLoading,
  disableButton,
  enableButton,
  showFormErrors,
} from '../utils/ui-helpers.js';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from '../services/task-service.js';
import { getProjects } from '../services/project-service.js';
import { getProjectStatuses, getDefaultStatus } from '../services/status-service.js';
import { subscribeToTasks, unsubscribeAll } from '../services/realtime-service.js';
import { initCommentThread, destroyCommentThread } from '../components/comment-thread.js';
import {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
  downloadAttachment,
} from '../services/attachment-service.js';
import {
  getTaskChecklists,
  createChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from '../services/checklist-service.js';
import { initTagPicker, renderTagBadges } from '../components/tag-picker.js';
import { getTaskTags, getTags } from '../services/tag-service.js';
import {
  initGanttChart,
  changeViewMode,
  highlightCriticalPath,
  destroyGanttChart,
  getDisplayableTasks,
  getMissingDatesTasks,
} from '../components/gantt-chart.js';
import {
  getGanttTasks,
  getDependencies,
  getCriticalPath,
  addDependency,
  removeDependency,
  autoScheduleTasks,
  updateTaskDates,
  moveTaskUp,
  moveTaskDown,
} from '../services/gantt-service.js';

// State
let tasks = [];
let projects = [];
let statuses = []; // Dynamic statuses for current project
let tags = []; // All available tags
let currentFilters = {
  project_id: '',
  status: '',
  tag_id: '',
  search: '',
};
let currentEditingTaskId = null;
let currentDeletingTaskId = null;
let currentUser = null;
let realtimeSubscriptionId = null;
let currentTaskAttachments = [];
let currentTagPickerInstance = null;

// Gantt state
let currentView = 'kanban'; // 'kanban', 'list', 'gantt'
let ganttInstance = null;
let isLoadingGantt = false; // Prevent infinite loops
let ganttSortOrder = 'gantt_position'; // Default sort order for Gantt - custom vertical order

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
    showLoading('Loading tasks...');

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

    hideLoading();

    // Render appropriate view
    if (currentView === 'gantt') {
      await loadGanttView();
    } else if (currentView === 'list') {
      renderListView();
    } else {
      await renderKanbanBoard();
    }
  } catch (error) {
    hideLoading();
    console.error('Error loading tasks:', error);
    showError('Failed to load tasks. Please try again.');
  }
}

/**
 * Render Kanban board
 */
async function renderKanbanBoard() {
  const container = document.getElementById('tasksContainer');

  // Load statuses for filtered project (or first project if none selected)
  const projectId = currentFilters.project_id || (projects.length > 0 ? projects[0].id : null);

  if (!projectId) {
    container.innerHTML = '<div class="empty-state"><p>No projects available. Please create a project first.</p></div>';
    return;
  }

  try {
    // Load dynamic statuses
    statuses = await getProjectStatuses(projectId);
  } catch (error) {
    console.error('Error loading statuses:', error);
    // Fallback to default statuses
    statuses = [
      { slug: 'todo', name: 'To Do', color: '#94a3b8', sort_order: 0 },
      { slug: 'in_progress', name: 'In Progress', color: '#3b82f6', sort_order: 1 },
      { slug: 'done', name: 'Done', color: '#10b981', sort_order: 2 },
    ];
  }

  // Apply search filter
  let filteredTasks = tasks;
  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }

  // Apply tag filter
  if (currentFilters.tag_id) {
    const tagId = parseInt(currentFilters.tag_id, 10);
    filteredTasks = filteredTasks.filter(
      (task) => task.tags && task.tags.some((tag) => tag.id === tagId)
    );
  }

  // Render Kanban columns dynamically
  const columns = statuses.map(status => {
    const statusTasks = filteredTasks.filter((t) => t.status === status.slug);
    return renderKanbanColumn(status.slug, status.name, statusTasks, status.color);
  }).join('');

  container.innerHTML = `
    <div class="task-board">
      ${columns}
    </div>
  `;

  // Attach event listeners to task cards
  attachTaskCardListeners();
}

/**
 * Render a Kanban column
 */
function renderKanbanColumn(status, title, tasks, color = '#6b7280') {
  const isEmpty = tasks.length === 0;

  return `
    <div class="task-column" data-status="${status}">
      <div class="task-column-header" style="border-top: 3px solid ${color}">
        <h3 class="task-column-title">${title}</h3>
        <span class="task-column-count" style="background-color: ${color}20; color: ${color}">${tasks.length}</span>
      </div>
      <div class="task-column-content">
        ${
          isEmpty
            ? `<div class="task-column-empty">
                <p>No tasks</p>
              </div>`
            : tasks.map((task) => renderTaskCard(task)).join('')
        }
      </div>
    </div>
  `;
}

/**
 * Calculate task age (time since creation) in days
 */
function getTaskAge(createdAt) {
  if (!createdAt) return '';

  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / 86400000);

  return `${diffDays}`;
}

/**
 * Render a task card
 */
function renderTaskCard(task) {
  const projectName = task.projects?.name || 'No project';
  const priorityClass = `task-priority ${task.priority}`;
  const dueDateDisplay = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  const taskAge = getTaskAge(task.created_at);

  return `
    <div class="task-card" data-task-id="${task.id}" data-status="${task.status}">
      <div class="task-card-header">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <div class="task-card-actions">
          <button class="btn-icon task-edit-btn" data-task-id="${task.id}" title="Edit task">
            <span>✏️</span>
          </button>
        </div>
      </div>

      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}

      <div class="task-meta">
        <span class="${priorityClass}">${capitalizeFirst(task.priority)}</span>
        ${dueDateDisplay ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">📅 ${dueDateDisplay}</span>` : ''}
        ${taskAge ? `<span class="task-age" style="color: var(--gray-500); font-size: 0.75rem;">🕒 ${taskAge}</span>` : ''}
      </div>

      ${task.tags && task.tags.length > 0 ? `
        <div class="task-tags">
          ${renderTagBadges(task.tags)}
        </div>
      ` : ''}

      <div class="task-footer">
        <span class="task-project">📁 ${escapeHtml(projectName)}</span>
        <div class="task-status-actions">
          ${renderStatusButtons(task)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render status change buttons (dynamic based on project statuses)
 */
function renderStatusButtons(task) {
  const buttons = [];

  // Find current status in the statuses array
  const currentIndex = statuses.findIndex(s => s.slug === task.status);
  if (currentIndex === -1) return ''; // Status not found

  const currentStatus = statuses[currentIndex];
  const nextStatus = statuses[currentIndex + 1];
  const prevStatus = statuses[currentIndex - 1];

  // Back button (move to previous status)
  if (prevStatus) {
    buttons.push(
      `<button class="btn-status btn-status-back" data-task-id="${task.id}" data-new-status="${prevStatus.slug}" title="Move to ${prevStatus.name}">⬅️</button>`
    );
  }

  // Next/Forward button (move to next status)
  if (nextStatus) {
    const icon = nextStatus.is_done ? '✅' : '▶️';
    const title = nextStatus.is_done ? 'Complete' : `Move to ${nextStatus.name}`;
    buttons.push(
      `<button class="btn-status btn-status-next" data-task-id="${task.id}" data-new-status="${nextStatus.slug}" title="${title}">${icon}</button>`
    );
  } else if (currentStatus.is_done) {
    // If already at the last status (done), show reopen button to first non-done status
    const firstNonDone = statuses.find(s => !s.is_done);
    if (firstNonDone) {
      buttons.push(
        `<button class="btn-status btn-status-reopen" data-task-id="${task.id}" data-new-status="${firstNonDone.slug}" title="Reopen">🔄</button>`
      );
    }
  }

  return buttons.join('');
}

/**
 * Attach event listeners to task cards
 */
function attachTaskCardListeners() {
  // Edit buttons
  document.querySelectorAll('.task-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      openEditModal(taskId);
    });
  });

  // Status change buttons
  document.querySelectorAll('.btn-status').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const newStatus = btn.dataset.newStatus;
      await changeTaskStatus(taskId, newStatus);
    });
  });

  // Click on card to view details
  document.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.task-card-actions') && !e.target.closest('.btn-status')) {
        const taskId = card.dataset.taskId;
        openViewModal(taskId);
      }
    });
  });
}

/**
 * Change task status
 */
async function changeTaskStatus(taskId, newStatus) {
  try {
    await updateTask(taskId, { status: newStatus });
    // Task will be updated via realtime subscription
    // But we'll reload to ensure UI is in sync
    await loadTasks();
  } catch (error) {
    console.error('Error changing task status:', error);
    showError('Failed to update task status');
  }
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
      renderKanbanBoard(); // Re-render without API call for tag filter
    });
  }

  if (searchTasks) {
    let searchTimeout;
    searchTasks.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = searchTasks.value;
        renderKanbanBoard(); // Re-render without API call for search
      }, 300);
    });
  }

  // Task form submission
  const taskFormSubmit = document.getElementById('taskFormSubmit');
  if (taskFormSubmit) {
    taskFormSubmit.addEventListener('click', submitTaskForm);
  }

  // Delete confirmation
  const confirmDeleteBtn = document.getElementById('confirmDeleteTaskBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }

  // Attachment upload
  const attachmentBtn = document.getElementById('taskAttachmentBtn');
  const attachmentInput = document.getElementById('taskAttachmentInput');

  if (attachmentBtn && attachmentInput) {
    attachmentBtn.addEventListener('click', () => {
      attachmentInput.click();
    });

    attachmentInput.addEventListener('change', handleAttachmentUpload);
  }

  // Modal close cleanup
  const taskModal = document.getElementById('taskModal');
  if (taskModal) {
    taskModal.addEventListener('hidden.bs.modal', () => {
      resetTaskForm();
      // Cleanup tag picker if it exists
      if (currentTagPickerInstance) {
        currentTagPickerInstance = null;
      }
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
      const oldOrder = ganttSortOrder;
      ganttSortOrder = ganttSortSelect.value;
      console.log(`📊 Gantt sort order changed from "${oldOrder}" to "${ganttSortOrder}"`);
      console.log('🔄 Current view:', currentView);
      if (currentView === 'gantt') {
        console.log('🔄 Reloading Gantt view with new sort order...');
        await loadGanttView();
      } else {
        console.warn('⚠️ Not in Gantt view, skipping reload');
      }
    });
  } else {
    console.error('❌ Gantt sort dropdown NOT found!');
  }

  // Critical path button
  const criticalPathBtn = document.getElementById('showCriticalPathBtn');
  if (criticalPathBtn) {
    criticalPathBtn.addEventListener('click', handleShowCriticalPath);
  }

  // Auto-schedule buttons
  const autoScheduleBtn = document.getElementById('autoScheduleBtn');
  const autoScheduleAllBtn = document.getElementById('autoScheduleAllBtn');

  if (autoScheduleBtn) {
    autoScheduleBtn.addEventListener('click', handleAutoSchedule);
  }

  if (autoScheduleAllBtn) {
    autoScheduleAllBtn.addEventListener('click', handleAutoSchedule);
  }

  // Add dependency button
  const addDependencyBtn = document.getElementById('addDependencyBtn');
  if (addDependencyBtn) {
    addDependencyBtn.addEventListener('click', handleAddDependencyClick);
  }

  // Confirm add dependency button
  const confirmAddDependency = document.getElementById('confirmAddDependency');
  if (confirmAddDependency) {
    confirmAddDependency.addEventListener('click', handleConfirmAddDependency);
  }
}

/**
 * Open create task modal
 */
function openCreateModal() {
  currentEditingTaskId = null;
  resetTaskForm();

  const title = document.getElementById('taskModalTitle');
  const submit = document.getElementById('taskFormSubmit');
  const deleteBtn = document.getElementById('taskFormDelete');
  const attachmentsSection = document.getElementById('taskAttachmentsSection');

  if (title) title.textContent = 'Create Task';
  if (submit) submit.textContent = 'Create Task';
  if (deleteBtn) deleteBtn.style.display = 'none';

  // Hide attachments section for new tasks
  if (attachmentsSection) attachmentsSection.style.display = 'none';

  const modal = new Modal(document.getElementById('taskModal'));
  modal.show();
}

/**
 * Open edit task modal
 */
async function openEditModal(taskId) {
  try {
    showLoading('Loading task...');
    const task = await getTask(taskId);
    hideLoading();

    currentEditingTaskId = taskId;

    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const projectInput = document.getElementById('taskProject');
    const priorityInput = document.getElementById('taskPriority');
    const startDateInput = document.getElementById('taskStartDate');
    const dueDateInput = document.getElementById('taskDueDate');
    const title = document.getElementById('taskModalTitle');
    const submit = document.getElementById('taskFormSubmit');
    const deleteBtn = document.getElementById('taskFormDelete');
    const attachmentsSection = document.getElementById('taskAttachmentsSection');
    const tagsSection = document.getElementById('taskTagsSection');
    const dependenciesSection = document.getElementById('taskDependenciesSection');

    if (titleInput) titleInput.value = task.title;
    if (descInput) descInput.value = task.description || '';
    if (projectInput) projectInput.value = task.project_id || '';
    if (priorityInput) priorityInput.value = task.priority;
    if (startDateInput) startDateInput.value = task.start_date || '';
    if (dueDateInput) dueDateInput.value = task.due_date || '';
    if (title) title.textContent = 'Edit Task';
    if (submit) submit.textContent = 'Save Changes';
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.onclick = () => openDeleteModal(taskId);
    }

    // Show tags section and initialize tag picker
    if (tagsSection) {
      tagsSection.style.display = 'block';
      const tagPickerContainer = document.getElementById('taskTagPicker');
      if (tagPickerContainer) {
        currentTagPickerInstance = await initTagPicker(tagPickerContainer, taskId);
      }
    }

    // Show attachments section and load attachments
    if (attachmentsSection) {
      attachmentsSection.style.display = 'block';
      await loadTaskAttachments(taskId);
    }

    // Show dependencies section and load dependencies
    if (dependenciesSection) {
      dependenciesSection.style.display = 'block';
      await renderTaskDependencies(taskId);
    }

    const modal = new Modal(document.getElementById('taskModal'));
    modal.show();
  } catch (error) {
    hideLoading();
    console.error('Error loading task:', error);
    showError('Failed to load task details');
  }
}

/**
 * Open view task modal
 */
async function openViewModal(taskId) {
  try {
    showLoading('Loading task...');
    const [task, attachments, checklists, taskTags] = await Promise.all([
      getTask(taskId),
      getAttachments(taskId),
      getTaskChecklists(taskId),
      getTaskTags(taskId),
    ]);
    hideLoading();

    const modalTitle = document.getElementById('viewTaskModalTitle');
    const modalContent = document.getElementById('viewTaskModalContent');

    if (modalTitle) {
      modalTitle.textContent = task.title;
    }

    if (modalContent) {
      const projectName = task.projects?.name || 'No project';
      const dueDateDisplay = task.due_date
        ? new Date(task.due_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'No due date';

      const taskAge = getTaskAge(task.created_at);
      const createdAtFull = new Date(task.created_at).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const attachmentsList =
        attachments && attachments.length > 0
          ? attachments
              .map(
                (att) => {
                  const isImage = att.mime_type?.startsWith('image/');
                  const isPDF = att.mime_type === 'application/pdf';
                  const canPreview = isImage || isPDF;

                  return `
          <li class="attachment-item-view">
            <div class="attachment-info">
              <span class="attachment-icon">${isImage ? '🖼️' : isPDF ? '📄' : '📎'}</span>
              <div class="attachment-details">
                <span class="attachment-name">${escapeHtml(att.file_name)}</span>
                <span class="attachment-meta">${formatFileSize(att.file_size)} · ${formatDate(att.created_at)}</span>
              </div>
            </div>
            <div class="attachment-actions">
              ${canPreview ? `
                <button class="btn-icon-sm" onclick="window.viewAttachment(${att.id}, '${att.mime_type}')" title="View">
                  <span>👁️</span>
                </button>
              ` : ''}
              <button class="btn-icon-sm" onclick="window.downloadAttachment(${att.id})" title="Download">
                <span>⬇️</span>
              </button>
              ${att.uploaded_by === currentUser?.id ? `
                <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteViewAttachment(${att.id}, ${taskId})" title="Delete">
                  <span>🗑️</span>
                </button>
              ` : ''}
            </div>
          </li>
        `;
                }
              )
              .join('')
          : '<li class="text-muted" style="padding: 1rem;">No attachments</li>';

      modalContent.innerHTML = `
        <ul class="nav nav-tabs mb-3" id="taskDetailTabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="details-tab" data-bs-toggle="tab" data-bs-target="#details-tab-pane" type="button" role="tab" aria-controls="details-tab-pane" aria-selected="true">
              <i class="bi bi-info-circle me-1"></i> Details
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="comments-tab" data-bs-toggle="tab" data-bs-target="#comments-tab-pane" type="button" role="tab" aria-controls="comments-tab-pane" aria-selected="false">
              <i class="bi bi-chat-dots me-1"></i> Comments
            </button>
          </li>
        </ul>

        <div class="tab-content" id="taskDetailTabContent">
          <!-- Details Tab -->
          <div class="tab-pane fade show active" id="details-tab-pane" role="tabpanel" aria-labelledby="details-tab" tabindex="0">
            <div class="view-task-content">
              <div class="view-task-section">
                <h6>Description</h6>
                <p>${task.description ? escapeHtml(task.description) : '<span class="text-muted">No description</span>'}</p>
              </div>

              <div class="view-task-section">
                <h6>Details</h6>
                <div class="view-task-details">
                  <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="task-status ${task.status}">${capitalizeFirst(task.status.replace('_', ' '))}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Priority:</span>
                    <span class="task-priority ${task.priority}">${capitalizeFirst(task.priority)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Project:</span>
                    <span>📁 ${escapeHtml(projectName)}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Due Date:</span>
                    <span>📅 ${dueDateDisplay}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span title="${createdAtFull}">🕒 ${taskAge}</span>
                  </div>
                  ${taskTags && taskTags.length > 0 ? `
                    <div class="detail-item" style="display: flex; gap: 0.5rem;">
                      <span class="detail-label" style="flex-shrink: 0;">Tags:</span>
                      <div class="tag-list" style="flex: 1;">
                        ${renderTagBadges(taskTags)}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="view-task-section">
                <h6>Attachments</h6>
                <ul class="attachments-list-view">
                  ${attachmentsList}
                </ul>
              </div>

              ${renderChecklistsSection(checklists || [])}
            </div>
          </div>

          <!-- Comments Tab -->
          <div class="tab-pane fade" id="comments-tab-pane" role="tabpanel" aria-labelledby="comments-tab" tabindex="0">
            <div id="task-comments-container"></div>
          </div>
        </div>
      `;

      // Store attachments and checklists for handlers
      window._viewAttachments = attachments;
      window._viewChecklists = checklists;

      // Setup checklist event listeners
      setupChecklistHandlers(taskId);

      // Setup Comments tab initialization
      const commentsTab = document.getElementById('comments-tab');
      if (commentsTab) {
        commentsTab.addEventListener('shown.bs.tab', async () => {
          const commentsContainer = document.getElementById('task-comments-container');
          if (commentsContainer && !commentsContainer.dataset.initialized) {
            await initCommentThread(taskId, commentsContainer);
            commentsContainer.dataset.initialized = 'true';
          }
        });
      }

      // Setup Edit and Delete button handlers
      const editBtn = document.getElementById('viewTaskEditBtn');
      const deleteBtn = document.getElementById('viewTaskDeleteBtn');

      if (editBtn) {
        editBtn.onclick = () => {
          const modal = Modal.getInstance(document.getElementById('viewTaskModal'));
          modal.hide();
          setTimeout(() => openEditModal(taskId), 300);
        };
      }

      if (deleteBtn) {
        deleteBtn.onclick = () => {
          // Close view modal first
          const viewModal = Modal.getInstance(document.getElementById('viewTaskModal'));
          if (viewModal) {
            viewModal.hide();
          }
          // Small delay to ensure modal is closed
          setTimeout(() => {
            currentDeletingTaskId = taskId;
            const taskName = document.getElementById('deleteTaskName');
            if (taskName) taskName.textContent = task.title;
            const deleteModal = new Modal(document.getElementById('deleteTaskModal'));
            deleteModal.show();
          }, 300);
        };
      }
    }

    const modal = new Modal(document.getElementById('viewTaskModal'));

    // Cleanup comments subscription when modal is hidden
    const modalElement = document.getElementById('viewTaskModal');
    modalElement.addEventListener('hidden.bs.modal', () => {
      const commentsContainer = document.getElementById('task-comments-container');
      if (commentsContainer) {
        destroyCommentThread(commentsContainer);
        delete commentsContainer.dataset.initialized;
      }
    }, { once: true });

    modal.show();
  } catch (error) {
    hideLoading();
    console.error('Error loading task:', error);
    showError('Failed to load task details');
  }
}

/**
 * Render checklists section
 */
function renderChecklistsSection(checklists) {
  const checklistsContent = checklists.length > 0
    ? checklists.map(checklist => renderChecklist(checklist)).join('')
    : '<p class="text-muted" style="padding: 1rem; text-align: center;">No checklists yet. Click "Add Checklist" to create one.</p>';

  return `
    <div class="view-task-section">
      <div class="section-header-with-action">
        <h6>Checklists</h6>
        <button class="btn-sm btn-outline-primary" onclick="window.addNewChecklist()">
          <span>➕</span>
          <span>Add Checklist</span>
        </button>
      </div>
      <div class="checklists-container">
        ${checklistsContent}
      </div>
    </div>
  `;
}

/**
 * Render a single checklist with items
 */
function renderChecklist(checklist) {
  const items = checklist.checklist_items || [];
  const totalItems = items.length;
  const completedItems = items.filter(item => item.is_completed).length;
  const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return `
    <div class="checklist-block" data-checklist-id="${checklist.id}">
      <div class="checklist-header">
        <div class="checklist-title-row">
          <h6 class="checklist-title">${escapeHtml(checklist.title)}</h6>
          <div class="checklist-header-actions">
            <span class="checklist-progress-text">${completedItems}/${totalItems}</span>
            <button
              class="btn-icon-xs checklist-delete-checklist-btn"
              onclick="window.deleteChecklistHandler(${checklist.id})"
              title="Delete checklist"
            >
              🗑️
            </button>
          </div>
        </div>
        <div class="checklist-progress-bar">
          <div class="checklist-progress-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
      <ul class="checklist-items-list">
        ${items.map(item => renderChecklistItem(item)).join('')}
        <li class="checklist-add-item">
          <button class="btn-link-sm" onclick="window.addChecklistItem(${checklist.id})">
            + Add item
          </button>
        </li>
      </ul>
    </div>
  `;
}

/**
 * Render a single checklist item
 */
function renderChecklistItem(item) {
  return `
    <li class="checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
      <input
        type="checkbox"
        class="checklist-checkbox"
        ${item.is_completed ? 'checked' : ''}
        onchange="window.toggleChecklistItemHandler(${item.id})"
      />
      <span class="checklist-item-content">${escapeHtml(item.content)}</span>
      <button
        class="btn-icon-xs checklist-delete-btn"
        onclick="window.deleteChecklistItemHandler(${item.id})"
        title="Delete item"
      >
        ✕
      </button>
    </li>
  `;
}

/**
 * Setup checklist event handlers
 */
function setupChecklistHandlers(taskId) {
  // Global handlers for checklist operations
  window.toggleChecklistItemHandler = async (itemId) => {
    try {
      await toggleChecklistItem(itemId);
      // Refresh modal
      setTimeout(() => openViewModal(taskId), 100);
    } catch (error) {
      console.error('Error toggling checklist item:', error);
      showError('Failed to update checklist item');
    }
  };

  window.deleteChecklistItemHandler = async (itemId) => {
    if (!confirm('Delete this checklist item?')) return;
    try {
      await deleteChecklistItem(itemId);
      showSuccess('Checklist item deleted');
      // Refresh modal
      setTimeout(() => openViewModal(taskId), 100);
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      showError('Failed to delete checklist item');
    }
  };

  window.addChecklistItem = async (checklistId) => {
    const content = prompt('Enter checklist item:');
    if (!content || !content.trim()) return;
    try {
      await createChecklistItem({ checklist_id: checklistId, content: content.trim() });
      showSuccess('Item added');
      // Refresh modal
      setTimeout(() => openViewModal(taskId), 100);
    } catch (error) {
      console.error('Error adding checklist item:', error);
      showError('Failed to add item');
    }
  };

  window.addNewChecklist = async () => {
    const title = prompt('Enter checklist name:');
    if (!title || !title.trim()) return;
    try {
      await createChecklist({ task_id: taskId, title: title.trim() });
      showSuccess('Checklist created');
      // Refresh modal
      setTimeout(() => openViewModal(taskId), 100);
    } catch (error) {
      console.error('Error creating checklist:', error);
      showError('Failed to create checklist');
    }
  };

  window.deleteChecklistHandler = async (checklistId) => {
    if (!confirm('Delete this entire checklist? All items will be removed.')) return;
    try {
      await deleteChecklist(checklistId);
      showSuccess('Checklist deleted');
      // Refresh modal
      setTimeout(() => openViewModal(taskId), 100);
    } catch (error) {
      console.error('Error deleting checklist:', error);
      showError('Failed to delete checklist');
    }
  };
}

/**
 * Open delete confirmation modal
 */
function openDeleteModal(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  currentDeletingTaskId = taskId;

  // Close edit modal if open
  const editModal = Modal.getInstance(document.getElementById('taskModal'));
  if (editModal) {
    editModal.hide();
  }

  const taskName = document.getElementById('deleteTaskName');
  if (taskName) taskName.textContent = task.title;

  const modal = new Modal(document.getElementById('deleteTaskModal'));
  modal.show();
}

/**
 * Submit task form
 */
async function submitTaskForm() {
  try {
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const projectInput = document.getElementById('taskProject');
    const priorityInput = document.getElementById('taskPriority');
    const startDateInput = document.getElementById('taskStartDate');
    const dueDateInput = document.getElementById('taskDueDate');
    const errorsDiv = document.getElementById('taskFormErrors');

    // Clear previous errors
    if (errorsDiv) errorsDiv.innerHTML = '';

    // Validate
    const errors = {};
    if (!titleInput.value.trim()) {
      errors.title = 'Task title is required';
    } else if (titleInput.value.length > 200) {
      errors.title = 'Task title must be 200 characters or less';
    }

    // Validate date range if both dates provided
    if (startDateInput.value && dueDateInput.value) {
      const startDate = new Date(startDateInput.value);
      const dueDate = new Date(dueDateInput.value);
      if (dueDate < startDate) {
        errors.due_date = 'Due date must be after start date';
      }
    }

    // Project is optional - tasks can exist without a project

    if (Object.keys(errors).length > 0) {
      showFormErrors(errors);
      return;
    }

    const submitBtn = document.getElementById('taskFormSubmit');
    disableButton(submitBtn, 'Saving...');

    const taskData = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      project_id: projectInput.value || null, // Allow null for tasks without projects
      priority: priorityInput.value,
      start_date: startDateInput.value || null,
      due_date: dueDateInput.value || null,
    };

    if (currentEditingTaskId) {
      // Update existing task
      await updateTask(currentEditingTaskId, taskData);
      showSuccess('Task updated successfully');
    } else {
      // Create new task
      await createTask(taskData);
      showSuccess('Task created successfully');
    }

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('taskModal'));
    modal.hide();

    await loadTasks();
    enableButton(submitBtn);
  } catch (error) {
    console.error('Error submitting task form:', error);
    showFormErrors({ general: error.message || 'Failed to save task' });
    const submitBtn = document.getElementById('taskFormSubmit');
    enableButton(submitBtn);
  }
}

/**
 * Confirm task deletion
 */
async function confirmDelete() {
  try {
    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    disableButton(confirmBtn, 'Deleting...');

    await deleteTask(currentDeletingTaskId);
    showSuccess('Task deleted successfully');

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('deleteTaskModal'));
    modal.hide();

    await loadTasks();
    enableButton(confirmBtn);
  } catch (error) {
    console.error('Error deleting task:', error);
    showError('Failed to delete task. Please try again.');
    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    enableButton(confirmBtn);
  }
}

/**
 * Reset task form
 */
function resetTaskForm() {
  const form = document.getElementById('taskForm');
  if (form) form.reset();

  const errorsDiv = document.getElementById('taskFormErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  const priorityInput = document.getElementById('taskPriority');
  if (priorityInput) priorityInput.value = 'medium';

  // Hide and clear attachments section
  const attachmentsSection = document.getElementById('taskAttachmentsSection');
  if (attachmentsSection) attachmentsSection.style.display = 'none';

  const attachmentsList = document.getElementById('taskAttachmentsList');
  if (attachmentsList) attachmentsList.innerHTML = '';

  currentEditingTaskId = null;
  currentTaskAttachments = [];
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

/**
 * Load attachments for a task (edit modal)
 */
async function loadTaskAttachments(taskId) {
  try {
    currentTaskAttachments = await getAttachments(taskId);
    renderTaskAttachments();
  } catch (error) {
    console.error('Error loading attachments:', error);
    showError('Failed to load attachments');
  }
}

/**
 * Render attachments in edit modal
 */
function renderTaskAttachments() {
  const attachmentsList = document.getElementById('taskAttachmentsList');
  if (!attachmentsList) return;

  if (currentTaskAttachments.length === 0) {
    attachmentsList.innerHTML = '<p class="text-muted" style="font-size: 0.875rem; margin: 0;">No attachments yet</p>';
    return;
  }

  attachmentsList.innerHTML = currentTaskAttachments
    .map(
      (att) => {
        const isImage = att.mime_type?.startsWith('image/');
        const isPDF = att.mime_type === 'application/pdf';
        const canPreview = isImage || isPDF;

        return `
    <div class="attachment-item-edit" data-attachment-id="${att.id}">
      <div class="attachment-info">
        <span class="attachment-icon">${isImage ? '🖼️' : isPDF ? '📄' : '📎'}</span>
        <div class="attachment-details">
          <span class="attachment-name">${escapeHtml(att.file_name)}</span>
          <span class="attachment-meta">${formatFileSize(att.file_size)} · ${formatDate(att.created_at)}</span>
        </div>
      </div>
      <div class="attachment-actions">
        ${canPreview ? `
          <button class="btn-icon-sm" onclick="window.viewAttachment(${att.id}, '${att.mime_type}')" title="View">
            <span>👁️</span>
          </button>
        ` : ''}
        <button class="btn-icon-sm" onclick="window.downloadAttachment(${att.id})" title="Download">
          <span>⬇️</span>
        </button>
        <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteEditAttachment(${att.id})" title="Delete">
          <span>🗑️</span>
        </button>
      </div>
    </div>
  `;
      }
    )
    .join('');
}

/**
 * Handle attachment file upload
 */
async function handleAttachmentUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  if (!currentEditingTaskId) {
    showError('Please save the task before uploading attachments');
    event.target.value = '';
    return;
  }

  // Validate file sizes (1MB limit per file)
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
  const oversizedFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);

  if (oversizedFiles.length > 0) {
    const fileNames = oversizedFiles.map(f =>
      `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`
    ).join(', ');
    showError(`File(s) exceed 1MB limit: ${fileNames}`);
    event.target.value = '';
    return;
  }

  try {
    showLoading('Uploading attachments...');

    for (const file of files) {
      const attachment = await uploadAttachment(currentEditingTaskId, file);
      currentTaskAttachments.push(attachment);
    }

    hideLoading();
    showSuccess(`${files.length} file(s) uploaded successfully`);
    renderTaskAttachments();

    // Clear input
    event.target.value = '';
  } catch (error) {
    hideLoading();
    console.error('Error uploading attachment:', error);
    showError(error.message || 'Failed to upload attachment');
    event.target.value = '';
  }
}

/**
 * Delete attachment from edit modal
 */
window.deleteEditAttachment = async function (attachmentId) {
  if (!confirm('Are you sure you want to delete this attachment?')) {
    return;
  }

  try {
    showLoading('Deleting attachment...');
    await deleteAttachment(attachmentId);
    hideLoading();

    // Remove from current list
    currentTaskAttachments = currentTaskAttachments.filter((att) => att.id !== attachmentId);
    renderTaskAttachments();

    showSuccess('Attachment deleted successfully');
  } catch (error) {
    hideLoading();
    console.error('Error deleting attachment:', error);
    showError(error.message || 'Failed to delete attachment');
  }
};

/**
 * Delete attachment from view modal
 */
window.deleteViewAttachment = async function (attachmentId, taskId) {
  if (!confirm('Are you sure you want to delete this attachment?')) {
    return;
  }

  try {
    showLoading('Deleting attachment...');
    await deleteAttachment(attachmentId);
    hideLoading();
    showSuccess('Attachment deleted successfully');

    // Close and reopen modal to refresh
    const modal = Modal.getInstance(document.getElementById('viewTaskModal'));
    if (modal) {
      modal.hide();
    }
    setTimeout(() => openViewModal(taskId), 300);
  } catch (error) {
    hideLoading();
    console.error('Error deleting attachment:', error);
    showError(error.message || 'Failed to delete attachment');
  }
};

/**
 * Download attachment from view modal
 */
window.downloadAttachment = function (attachmentId) {
  const attachment = window._viewAttachments?.find((att) => att.id === attachmentId);
  if (!attachment) {
    showError('Attachment not found');
    return;
  }

  try {
    downloadAttachment(attachment);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    showError('Failed to download attachment');
  }
};

/**
 * Utility functions
 */

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * View attachment (preview images/PDFs)
 */
window.viewAttachment = async function (attachmentId, mimeType) {
  try {
    showLoading('Loading preview...');

    // Find attachment in current list or fetch it
    let attachment = currentTaskAttachments?.find(a => a.id === attachmentId);
    if (!attachment && window._viewAttachments) {
      attachment = window._viewAttachments.find(a => a.id === attachmentId);
    }

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Get public URL from Supabase Storage
    const { data } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(attachment.file_path, 3600); // 1 hour expiry

    hideLoading();

    if (!data?.signedUrl) {
      throw new Error('Failed to get file URL');
    }

    const isImage = mimeType?.startsWith('image/');
    const isPDF = mimeType === 'application/pdf';

    if (isImage) {
      // Show image in modal
      showImagePreview(data.signedUrl, attachment.file_name);
    } else if (isPDF) {
      // Open PDF in new tab
      window.open(data.signedUrl, '_blank');
    }
  } catch (error) {
    hideLoading();
    console.error('Error viewing attachment:', error);
    showError(error.message || 'Failed to view attachment');
  }
};

/**
 * Show image preview in modal
 */
function showImagePreview(imageUrl, fileName) {
  // Create modal dynamically
  const existingModal = document.getElementById('imagePreviewModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div class="modal fade" id="imagePreviewModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(fileName)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center" style="max-height: 80vh; overflow: auto;">
            <img src="${imageUrl}" alt="${escapeHtml(fileName)}" style="max-width: 100%; height: auto;">
          </div>
          <div class="modal-footer">
            <a href="${imageUrl}" download="${escapeHtml(fileName)}" class="btn btn-primary">Download</a>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const modal = new Modal(document.getElementById('imagePreviewModal'));
  modal.show();

  // Clean up when closed
  document.getElementById('imagePreviewModal').addEventListener('hidden.bs.modal', function () {
    this.remove();
  });
}

// Expose openViewModal to window for comment-thread component
window.openViewModal = openViewModal;

// Expose Gantt reorder functions to window for popup buttons
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
    await loadGanttView();
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
    await loadGanttView();
    console.log('✅ Gantt view reloaded');
  } catch (error) {
    console.error('❌ Error in moveGanttTaskDown:', error);
    showError('Failed to move task: ' + error.message);
  }
};

console.log('✅ Gantt reorder functions registered on window object');

// ========================================
// Gantt View Functions
// ========================================

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
      await loadGanttView();
    } else if (view === 'list') {
      renderListView();
    } else {
      await renderKanbanBoard();
    }

    console.log(`✅ ${view} view loaded`);
  } catch (error) {
    console.error(`Error loading ${view} view:`, error);
    showError(`Failed to load ${view} view`);
  }
}

/**
 * Load and render Gantt chart
 */
async function loadGanttView() {
  // Prevent infinite loop - don't reload if already loading
  if (isLoadingGantt) {
    console.warn('⚠️ Gantt view already loading, skipping...');
    return;
  }

  try {
    isLoadingGantt = true;
    console.log('📊 === LOADING GANTT VIEW ===');

    // Check if Frappe Gantt is loaded
    if (typeof Gantt === 'undefined') {
      console.error('❌ Frappe Gantt library not loaded from CDN');
      showError('Gantt chart library failed to load. Please refresh the page.');
      isLoadingGantt = false;
      return;
    }
    console.log('✅ Frappe Gantt library is available');

    const container = document.getElementById('ganttChart');
    const emptyState = document.querySelector('.gantt-empty');

    if (!container || !emptyState) {
      console.error('❌ Gantt container elements not found in DOM');
      return;
    }
    console.log('✅ Gantt container elements found');

    // Auto-schedule unscheduled tasks if project is selected
    if (currentFilters.project_id) {
      try {
        console.log('🔄 Auto-scheduling tasks for project:', currentFilters.project_id);
        const result = await autoScheduleTasks(currentFilters.project_id);
        console.log(`✅ Auto-scheduled ${result.updated} tasks`);

        // Reload tasks to get updated dates
        const filters = {};
        if (currentFilters.project_id) filters.project_id = currentFilters.project_id;
        if (currentFilters.status) filters.status = currentFilters.status;
        tasks = await getTasks(filters);
        console.log('📋 Reloaded tasks after auto-schedule:', tasks.length);
      } catch (error) {
        console.error('❌ Error auto-scheduling:', error);
      }
    } else {
      console.warn('⚠️ No project selected - select a project to view Gantt chart');
    }

    // Initialize Gantt chart
    ganttInstance = await initGanttChart(container, {
      project_id: currentFilters.project_id,
      sort_by: ganttSortOrder,
      viewMode: 'Day',
      onTaskClick: (task) => {
        openViewModal(parseInt(task.id));
      },
      onDateChange: async (task, start, end) => {
        try {
          console.log('📅 Date change requested:', {
            task: task.name,
            taskId: task.id,
            oldStart: task._start,
            newStart: start,
            oldEnd: task._end,
            newEnd: end
          });

          const result = await updateTaskDates(parseInt(task.id), {
            start_date: start.toISOString(),
            due_date: end.toISOString(),
          });

          console.log('✅ Database update result:', result);
          showSuccess(`Task dates updated: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);

          // Update local tasks array without full reload
          const taskIndex = tasks.findIndex(t => t.id === parseInt(task.id));
          if (taskIndex !== -1) {
            tasks[taskIndex].start_date = start.toISOString();
            tasks[taskIndex].due_date = end.toISOString();
            console.log('✅ Local tasks array updated');
          } else {
            console.warn('⚠️ Could not find task in local array');
          }
        } catch (error) {
          console.error('❌ Error updating task dates:', error);
          showError('Failed to update task dates: ' + error.message);
        }
      },
      onProgressChange: async (task, progress) => {
        // Optionally update task status based on progress
        // For now, we'll skip this as it's less important than date changes
      },
    });

    // Check if Gantt initialized successfully
    const hasGanttChart = ganttInstance !== null;

    container.style.display = hasGanttChart ? 'block' : 'none';
    emptyState.style.display = hasGanttChart ? 'none' : 'flex';

    if (!hasGanttChart) {
      const emptyMessage = emptyState.querySelector('p');
      if (!currentFilters.project_id) {
        emptyMessage.textContent = 'Please select a project from the filter dropdown to view Gantt chart.';
      } else if (tasks.length === 0) {
        emptyMessage.textContent = 'No tasks found. Create some tasks first.';
      } else {
        const missingCount = getMissingDatesTasks(tasks).length;
        emptyMessage.textContent = missingCount > 0
          ? `${missingCount} task(s) need start date and due date. Click "Auto-Schedule" above to populate dates automatically.`
          : 'No tasks with dates to display.';
      }
      console.warn('📊 Gantt empty state:', emptyMessage.textContent);
    } else {
      console.log('✅ Gantt chart displayed with tasks');
    }

    // Add reorder controls to task bars
    addTaskBarReorderControls();

    isLoadingGantt = false;
    console.log('✅ Gantt view loaded successfully');
  } catch (error) {
    isLoadingGantt = false;
    console.error('Error loading Gantt view:', error);
    showError('Failed to load Gantt view');
  }
}

/**
 * Add vertical drag-and-drop reordering to Gantt task bars
 */
function addTaskBarReorderControls() {
  setTimeout(() => {
    const ganttContainer = document.querySelector('.gantt');
    if (!ganttContainer) return;

    let state = {
      draggedBar: null,
      dragClone: null,
      dragIndicator: null,
      currentTarget: null,
      startY: 0,
      startX: 0,
      offsetY: 0,
      isDragging: false
    };

    // Create reusable clone element
    function createDragClone(barWrapper, mouseY) {
      const rect = barWrapper.getBoundingClientRect();
      const clone = barWrapper.cloneNode(true);

      clone.id = 'drag-clone-temp';
      clone.style.cssText = `
        position: fixed !important;
        left: ${rect.left}px !important;
        top: ${mouseY - state.offsetY}px !important;
        width: ${rect.width}px !important;
        height: ${rect.height}px !important;
        opacity: 0.9 !important;
        pointer-events: none !important;
        z-index: 999999 !important;
        transform: scale(1.03) !important;
        box-shadow: 0 12px 24px rgba(0,0,0,0.4) !important;
        transition: none !important;
      `;

      return clone;
    }

    // Create indicator line
    function createIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'drag-indicator-temp';
      indicator.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: #3b82f6;
        display: none;
        z-index: 1000;
        pointer-events: none;
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.7);
      `;
      return indicator;
    }

    // Handle mousedown on task bars
    ganttContainer.addEventListener('mousedown', (e) => {
      const barWrapper = e.target.closest('.bar-wrapper');
      if (!barWrapper || e.button !== 0) return;

      state.draggedBar = barWrapper;
      state.startY = e.clientY;
      state.startX = e.clientX;

      const rect = barWrapper.getBoundingClientRect();
      state.offsetY = e.clientY - rect.top;

      // Don't prevent default yet - let Frappe Gantt handle horizontal drag
    }, true);

    // Handle mousemove
    document.addEventListener('mousemove', (e) => {
      if (!state.draggedBar) return;

      const deltaY = Math.abs(e.clientY - state.startY);
      const deltaX = Math.abs(e.clientX - state.startX);

      // Only activate vertical drag if moving clearly vertically (not horizontally)
      // This lets Frappe Gantt handle horizontal drag for date changes
      if (!state.isDragging && deltaY > 10 && deltaY > deltaX * 1.5) {
        state.isDragging = true;

        // Now prevent further events to take over from Frappe Gantt
        e.preventDefault();
        e.stopPropagation();

        // Create and append clone
        state.dragClone = createDragClone(state.draggedBar, e.clientY);
        document.body.appendChild(state.dragClone);

        // Create and append indicator
        state.dragIndicator = createIndicator();
        ganttContainer.appendChild(state.dragIndicator);

        // Make original transparent
        state.draggedBar.style.opacity = '0.3';
      }

      // If dragging horizontally, let Frappe Gantt handle it
      if (!state.isDragging && deltaX > 10) {
        // Reset state to let Frappe Gantt take over
        state.draggedBar = null;
        return;
      }

      // Update clone position during drag
      if (state.isDragging && state.dragClone) {
        const rect = state.draggedBar.getBoundingClientRect();
        state.dragClone.style.left = rect.left + 'px';
        state.dragClone.style.top = (e.clientY - state.offsetY) + 'px';

        // Find target and update indicator
        const allBars = Array.from(ganttContainer.querySelectorAll('.bar-wrapper'));
        const targetBar = allBars.find(bar => {
          if (bar === state.draggedBar) return false;
          const targetRect = bar.getBoundingClientRect();
          return e.clientY >= targetRect.top && e.clientY <= targetRect.bottom;
        });

        if (targetBar && state.dragIndicator) {
          state.currentTarget = targetBar;
          const targetRect = targetBar.getBoundingClientRect();
          const containerRect = ganttContainer.getBoundingClientRect();

          const insertAbove = e.clientY < (targetRect.top + targetRect.height / 2);
          const top = insertAbove ?
            (targetRect.top - containerRect.top + ganttContainer.scrollTop) :
            (targetRect.bottom - containerRect.top + ganttContainer.scrollTop);

          state.dragIndicator.style.top = top + 'px';
          state.dragIndicator.style.display = 'block';
        }
      }
    });

    // Handle mouseup
    document.addEventListener('mouseup', async (e) => {
      if (!state.draggedBar) return;

      if (state.isDragging && state.currentTarget) {
        const draggedId = parseInt(state.draggedBar.getAttribute('data-id'));
        const targetId = parseInt(state.currentTarget.getAttribute('data-id'));

        if (draggedId !== targetId) {
          const targetRect = state.currentTarget.getBoundingClientRect();
          const insertBefore = e.clientY < (targetRect.top + targetRect.height / 2);
          await reorderTaskNear(draggedId, targetId, insertBefore);
        }
      }

      // Cleanup
      if (state.draggedBar) state.draggedBar.style.opacity = '1';
      if (state.dragClone) state.dragClone.remove();
      if (state.dragIndicator) state.dragIndicator.remove();

      state = {
        draggedBar: null,
        dragClone: null,
        dragIndicator: null,
        currentTarget: null,
        startY: 0,
        startX: 0,
        offsetY: 0,
        isDragging: false
      };
    });
  }, 500);
}

/**
 * Get the target bar based on cursor Y position
 */
function getTargetBarFromY(allBars, cursorY, excludeBar) {
  let closestBar = null;
  let closestDistance = Infinity;

  allBars.forEach(bar => {
    if (bar === excludeBar) return;

    const rect = bar.getBoundingClientRect();
    const barCenterY = rect.top + rect.height / 2;
    const distance = Math.abs(cursorY - barCenterY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestBar = bar;
    }
  });

  return closestBar;
}

/**
 * Reorder task near another task
 */
async function reorderTaskNear(movedTaskId, targetTaskId, insertBefore) {
  try {
    if (!currentFilters.project_id) {
      showError('Project must be selected');
      return;
    }

    // Get all tasks
    const filters = { project_id: currentFilters.project_id, sort_by: 'gantt_position' };
    const allTasks = await getGanttTasks(filters);

    const movedIndex = allTasks.findIndex(t => t.id === movedTaskId);
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);

    if (movedIndex === -1 || targetIndex === -1) return;

    // Reorder array
    const [movedTask] = allTasks.splice(movedIndex, 1);
    let newTargetIndex;
    if (insertBefore) {
      newTargetIndex = movedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    } else {
      newTargetIndex = movedIndex < targetIndex ? targetIndex : targetIndex + 1;
    }
    allTasks.splice(newTargetIndex, 0, movedTask);

    // Build updates array
    const updates = allTasks.map((task, index) => ({
      id: task.id,
      gantt_position: index + 1
    }));

    // Update all tasks in parallel for best performance
    const promises = updates.map(update =>
      supabase
        .from('tasks')
        .update({ gantt_position: update.gantt_position })
        .eq('id', update.id)
    );

    await Promise.all(promises);

    await loadGanttView();
  } catch (error) {
    console.error('Error reordering:', error);
    showError('Failed to reorder task');
  }
}

/**
 * Render list view
 */
function renderListView() {
  const tbody = document.getElementById('listViewTableBody');
  if (!tbody) return;

  const filteredTasks = filterTasks(tasks);

  if (filteredTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No tasks found</td></tr>';
    return;
  }

  tbody.innerHTML = filteredTasks.map(task => {
    const project = task.projects || { name: 'No Project', color: '#6c757d' };
    const assignee = task.assigned_to_user
      ? (task.assigned_to_user.user_metadata?.full_name || task.assigned_to_user.email)
      : 'Unassigned';

    return `
      <tr style="cursor: pointer;" onclick="window.openViewModal(${task.id})">
        <td>
          <div class="fw-semibold">${escapeHtml(task.title)}</div>
          ${task.tags && task.tags.length > 0 ? renderTagBadges(task.tags) : ''}
        </td>
        <td>
          <span class="badge" style="background-color: ${project.color}">
            ${escapeHtml(project.name)}
          </span>
        </td>
        <td><span class="badge bg-${getStatusBadgeClass(task.status)}">${formatStatus(task.status)}</span></td>
        <td><span class="badge bg-${getPriorityBadgeClass(task.priority)}">${formatPriority(task.priority)}</span></td>
        <td>${task.due_date ? formatDueDate(task.due_date) : '-'}</td>
        <td>${escapeHtml(assignee)}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Handle show critical path button click
 */
async function handleShowCriticalPath() {
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
async function handleAutoSchedule() {
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

    // Reload Gantt view
    console.log('🔄 Reloading tasks after auto-schedule...');
    await loadTasks();
  } catch (error) {
    hideLoading();
    console.error('❌ Error auto-scheduling:', error);
    showError('Failed to auto-schedule tasks');
  }
}

/**
 * Handle add dependency button click
 */
async function handleAddDependencyClick() {
  try {
    if (!currentEditingTaskId) return;

    // Get all tasks in the same project
    const task = tasks.find(t => t.id === currentEditingTaskId);
    if (!task) return;

    const projectTasks = tasks.filter(t =>
      t.project_id === task.project_id &&
      t.id !== currentEditingTaskId
    );

    if (projectTasks.length === 0) {
      showError('No other tasks in this project to create dependencies');
      return;
    }

    // Populate dropdown
    const select = document.getElementById('dependencyTaskSelect');
    if (select) {
      select.innerHTML = '<option value="">Select a task...</option>' +
        projectTasks.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
    }

    // Show modal
    const modal = new Modal(document.getElementById('dependencyModal'));
    modal.show();
  } catch (error) {
    console.error('Error preparing dependency modal:', error);
    showError('Failed to load tasks for dependencies');
  }
}

/**
 * Handle confirm add dependency
 */
async function handleConfirmAddDependency() {
  try {
    const select = document.getElementById('dependencyTaskSelect');
    const dependsOnTaskId = parseInt(select?.value);

    if (!dependsOnTaskId || !currentEditingTaskId) {
      showError('Please select a task');
      return;
    }

    showLoading('Adding dependency...');
    await addDependency({
      task_id: currentEditingTaskId,
      depends_on_task_id: dependsOnTaskId,
      dependency_type: 'finish_to_start'
    });
    hideLoading();

    showSuccess('Dependency added');

    // Close modal
    const modal = Modal.getInstance(document.getElementById('dependencyModal'));
    if (modal) modal.hide();

    // Reload dependencies in edit form
    await renderTaskDependencies(currentEditingTaskId);

    // Reload Gantt if in Gantt view
    if (currentView === 'gantt') {
      await loadTasks();
    }
  } catch (error) {
    hideLoading();
    console.error('Error adding dependency:', error);

    if (error.message?.includes('circular')) {
      showError('Cannot add dependency: Creates a circular dependency chain');
    } else {
      showError('Failed to add dependency');
    }
  }
}

/**
 * Render task dependencies in edit modal
 */
async function renderTaskDependencies(taskId) {
  const container = document.getElementById('taskDependencies');
  if (!container) return;

  try {
    const deps = await getDependencies(taskId);

    if (deps.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">No dependencies</p>';
      return;
    }

    container.innerHTML = deps.map(dep => `
      <div class="dependency-item">
        <span>${escapeHtml(dep.depends_on_task.title)}</span>
        <button type="button" class="btn btn-sm btn-link text-danger"
                onclick="handleRemoveDependency(${taskId}, ${dep.depends_on_task_id})">
          Remove
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error rendering dependencies:', error);
    container.innerHTML = '<p class="text-danger">Failed to load dependencies</p>';
  }
}

/**
 * Handle remove dependency
 */
window.handleRemoveDependency = async function(taskId, dependsOnTaskId) {
  try {
    showLoading('Removing dependency...');
    await removeDependency(taskId, dependsOnTaskId);
    hideLoading();

    showSuccess('Dependency removed');

    // Reload dependencies
    await renderTaskDependencies(taskId);

    // Reload Gantt if in Gantt view
    if (currentView === 'gantt') {
      await loadTasks();
    }
  } catch (error) {
    hideLoading();
    console.error('Error removing dependency:', error);
    showError('Failed to remove dependency');
  }
};

/**
 * Helper: Filter tasks based on current filters
 */
function filterTasks(tasks) {
  return tasks.filter(task => {
    // Tag filter
    if (currentFilters.tag_id) {
      const hasTag = task.tags?.some(tag => tag.id === parseInt(currentFilters.tag_id));
      if (!hasTag) return false;
    }

    // Search filter
    if (currentFilters.search) {
      const search = currentFilters.search.toLowerCase();
      const matchesTitle = task.title?.toLowerCase().includes(search);
      const matchesDescription = task.description?.toLowerCase().includes(search);
      if (!matchesTitle && !matchesDescription) return false;
    }

    return true;
  });
}

/**
 * Helper: Format status for display
 */
function formatStatus(status) {
  const statusMap = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'in_review': 'In Review',
    'done': 'Done'
  };
  return statusMap[status] || status;
}

/**
 * Helper: Format priority for display
 */
function formatPriority(priority) {
  return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Medium';
}

/**
 * Helper: Get badge class for status
 */
function getStatusBadgeClass(status) {
  const classMap = {
    'todo': 'secondary',
    'in_progress': 'primary',
    'in_review': 'warning',
    'done': 'success'
  };
  return classMap[status] || 'secondary';
}

/**
 * Helper: Get badge class for priority
 */
function getPriorityBadgeClass(priority) {
  const classMap = {
    'low': 'secondary',
    'medium': 'info',
    'high': 'warning',
    'urgent': 'danger'
  };
  return classMap[priority] || 'info';
}

/**
 * Helper: Format due date
 */
function formatDueDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `<span class="text-danger">${date.toLocaleDateString()}</span>`;
  } else if (diffDays === 0) {
    return '<span class="text-warning">Today</span>';
  } else if (diffDays === 1) {
    return '<span class="text-warning">Tomorrow</span>';
  } else {
    return date.toLocaleDateString();
  }
}

// Initialize on page load
init();
