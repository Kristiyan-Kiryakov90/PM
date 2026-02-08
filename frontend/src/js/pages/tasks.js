/**
 * Tasks Page Logic
 * Handles task CRUD operations, Kanban board, and real-time updates
 */

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
import { subscribeToTasks, unsubscribeAll } from '../services/realtime-service.js';
import {
  uploadAttachment,
  getAttachments,
  deleteAttachment,
  downloadAttachment,
} from '../services/attachment-service.js';

// State
let tasks = [];
let projects = [];
let currentFilters = {
  project_id: '',
  status: '',
  assigned_to: '',
  search: '',
};
let currentEditingTaskId = null;
let currentDeletingTaskId = null;
let currentUser = null;
let realtimeSubscriptionId = null;
let currentTaskAttachments = [];

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
 * Load tasks from the API
 */
async function loadTasks() {
  try {
    showLoading('Loading tasks...');

    const filters = {};
    if (currentFilters.project_id) filters.project_id = currentFilters.project_id;
    if (currentFilters.status) filters.status = currentFilters.status;
    if (currentFilters.assigned_to) filters.assigned_to = currentFilters.assigned_to;

    tasks = await getTasks(filters);
    hideLoading();
    renderKanbanBoard();
  } catch (error) {
    hideLoading();
    console.error('Error loading tasks:', error);
    showError('Failed to load tasks. Please try again.');
  }
}

/**
 * Render Kanban board
 */
function renderKanbanBoard() {
  const container = document.getElementById('tasksContainer');

  // Apply search filter
  let filteredTasks = tasks;
  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredTasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
    );
  }

  // Group tasks by status
  const todoTasks = filteredTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = filteredTasks.filter((t) => t.status === 'done');

  // Render Kanban columns
  container.innerHTML = `
    <div class="task-board">
      ${renderKanbanColumn('todo', 'To Do', todoTasks)}
      ${renderKanbanColumn('in_progress', 'In Progress', inProgressTasks)}
      ${renderKanbanColumn('done', 'Done', doneTasks)}
    </div>
  `;

  // Attach event listeners to task cards
  attachTaskCardListeners();
}

/**
 * Render a Kanban column
 */
function renderKanbanColumn(status, title, tasks) {
  const isEmpty = tasks.length === 0;

  return `
    <div class="task-column" data-status="${status}">
      <div class="task-column-header">
        <h3 class="task-column-title">${title}</h3>
        <span class="task-column-count">${tasks.length}</span>
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
      </div>

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
 * Render status change buttons
 */
function renderStatusButtons(task) {
  const buttons = [];

  if (task.status !== 'todo') {
    buttons.push(
      `<button class="btn-status btn-status-todo" data-task-id="${task.id}" data-new-status="todo" title="Move to To Do">⬅️</button>`
    );
  }

  if (task.status === 'todo') {
    buttons.push(
      `<button class="btn-status btn-status-progress" data-task-id="${task.id}" data-new-status="in_progress" title="Start">▶️</button>`
    );
  }

  if (task.status === 'in_progress') {
    buttons.push(
      `<button class="btn-status btn-status-done" data-task-id="${task.id}" data-new-status="done" title="Complete">✅</button>`
    );
  }

  if (task.status === 'done') {
    buttons.push(
      `<button class="btn-status btn-status-progress" data-task-id="${task.id}" data-new-status="in_progress" title="Reopen">🔄</button>`
    );
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
    taskModal.addEventListener('hidden.bs.modal', resetTaskForm);
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

  const modal = new bootstrap.Modal(document.getElementById('taskModal'));
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
    const dueDateInput = document.getElementById('taskDueDate');
    const title = document.getElementById('taskModalTitle');
    const submit = document.getElementById('taskFormSubmit');
    const deleteBtn = document.getElementById('taskFormDelete');
    const attachmentsSection = document.getElementById('taskAttachmentsSection');

    if (titleInput) titleInput.value = task.title;
    if (descInput) descInput.value = task.description || '';
    if (projectInput) projectInput.value = task.project_id || '';
    if (priorityInput) priorityInput.value = task.priority;
    if (dueDateInput) dueDateInput.value = task.due_date || '';
    if (title) title.textContent = 'Edit Task';
    if (submit) submit.textContent = 'Save Changes';
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.onclick = () => openDeleteModal(taskId);
    }

    // Show attachments section and load attachments
    if (attachmentsSection) {
      attachmentsSection.style.display = 'block';
      await loadTaskAttachments(taskId);
    }

    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
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
    const task = await getTask(taskId);
    const attachments = await getAttachments(taskId);
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

      const attachmentsList =
        attachments && attachments.length > 0
          ? attachments
              .map(
                (att) => `
          <li class="attachment-item-view">
            <div class="attachment-info">
              <span class="attachment-icon">📎</span>
              <div class="attachment-details">
                <span class="attachment-name">${escapeHtml(att.file_name)}</span>
                <span class="attachment-meta">${formatFileSize(att.file_size)} · ${formatDate(att.created_at)}</span>
              </div>
            </div>
            <div class="attachment-actions">
              <button class="btn-icon-sm" onclick="window.downloadAttachment(${att.id})" title="Download">
                <span>⬇️</span>
              </button>
              ${att.uploaded_by === '${currentUser?.id}' ? `
                <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteViewAttachment(${att.id}, ${taskId})" title="Delete">
                  <span>🗑️</span>
                </button>
              ` : ''}
            </div>
          </li>
        `
              )
              .join('')
          : '<li class="text-muted" style="padding: 1rem;">No attachments</li>';

      modalContent.innerHTML = `
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
            </div>
          </div>

          <div class="view-task-section">
            <h6>Attachments</h6>
            <ul class="attachments-list-view">
              ${attachmentsList}
            </ul>
          </div>
        </div>
      `;

      // Store attachments for download/delete handlers
      window._viewAttachments = attachments;
    }

    const modal = new bootstrap.Modal(document.getElementById('viewTaskModal'));
    modal.show();
  } catch (error) {
    hideLoading();
    console.error('Error loading task:', error);
    showError('Failed to load task details');
  }
}

/**
 * Open delete confirmation modal
 */
function openDeleteModal(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  currentDeletingTaskId = taskId;

  // Close edit modal if open
  const editModal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
  if (editModal) {
    editModal.hide();
  }

  const taskName = document.getElementById('deleteTaskName');
  if (taskName) taskName.textContent = task.title;

  const modal = new bootstrap.Modal(document.getElementById('deleteTaskModal'));
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

    if (!projectInput.value) {
      errors.project = 'Project is required';
    }

    if (Object.keys(errors).length > 0) {
      showFormErrors(errors);
      return;
    }

    const submitBtn = document.getElementById('taskFormSubmit');
    disableButton(submitBtn, 'Saving...');

    const taskData = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      project_id: projectInput.value,
      priority: priorityInput.value,
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
    const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
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
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteTaskModal'));
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
      (att) => `
    <div class="attachment-item-edit" data-attachment-id="${att.id}">
      <div class="attachment-info">
        <span class="attachment-icon">📎</span>
        <div class="attachment-details">
          <span class="attachment-name">${escapeHtml(att.file_name)}</span>
          <span class="attachment-meta">${formatFileSize(att.file_size)} · ${formatDate(att.created_at)}</span>
        </div>
      </div>
      <button class="btn-icon-sm btn-danger-icon" onclick="window.deleteEditAttachment(${att.id})" title="Delete">
        <span>🗑️</span>
      </button>
    </div>
  `
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
    const modal = bootstrap.Modal.getInstance(document.getElementById('viewTaskModal'));
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

// Initialize on page load
init();
