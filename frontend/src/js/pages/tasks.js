/**
 * Tasks Page Logic
 * Handles task CRUD operations, Kanban board, and real-time updates
 */

import { Modal } from 'bootstrap';
import supabase from '../services/supabase.js';
import { renderNavbar } from '../components/navbar.js';
import { renderSidebar } from '../components/sidebar.js';
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

// State
let tasks = [];
let projects = [];
let statuses = []; // Dynamic statuses for current project
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

    // Render sidebar
    await renderSidebar();

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
    await renderKanbanBoard();
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
    filteredTasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
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
    const [task, attachments, checklists] = await Promise.all([
      getTask(taskId),
      getAttachments(taskId),
      getTaskChecklists(taskId),
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

// Initialize on page load
init();
