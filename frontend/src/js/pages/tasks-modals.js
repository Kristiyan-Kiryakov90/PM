/**
 * Task Modals Module
 * Handles create, edit, view, and delete modal operations
 */

import { Modal } from 'bootstrap';
import {
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from '../services/task-service.js';
import { getAttachments } from '../services/attachment-service.js';
import { getTaskChecklists } from '../services/checklist-service.js';
import { getTaskTags } from '../services/tag-service.js';
import { initTagPicker } from '../components/tag-picker.js';
import { initCommentThread, destroyCommentThread } from '../components/comment-thread.js';
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
  loadTaskAttachments,
  setEditingTaskId as setAttachmentTaskId,
  handleAttachmentUpload,
} from './tasks-attachments.js';
import { renderChecklistsSection, setupChecklistHandlers } from './tasks-checklists.js';
import { renderTaskDependencies } from './tasks-dependencies.js';
import { escapeHtml, capitalizeFirst, getTaskAge, formatFileSize, formatDate } from './tasks-utils.js';
import { renderTagBadges } from '../components/tag-picker.js';

// Modal state
let currentEditingTaskId = null;
let currentDeletingTaskId = null;
let currentTagPickerInstance = null;
let currentUser = null;

/**
 * Initialize modals module
 */
export function initModalsModule(user) {
  currentUser = user;
}

/**
 * Get current editing task ID
 */
export function getCurrentEditingTaskId() {
  return currentEditingTaskId;
}

/**
 * Open create task modal
 */
export function openCreateModal() {
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
export async function openEditModal(taskId) {
  try {
    showLoading('Loading task...');
    const task = await getTask(taskId);
    hideLoading();

    currentEditingTaskId = taskId;
    setAttachmentTaskId(taskId);

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
export async function openViewModal(taskId) {
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
      setupChecklistHandlers(taskId, openViewModal);

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
 * Open delete confirmation modal
 */
export function openDeleteModal(taskId, tasks) {
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
export async function submitTaskForm(reloadTasks) {
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

    await reloadTasks();
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
export async function confirmDelete(reloadTasks) {
  try {
    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    disableButton(confirmBtn, 'Deleting...');

    await deleteTask(currentDeletingTaskId);
    showSuccess('Task deleted successfully');

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('deleteTaskModal'));
    modal.hide();

    await reloadTasks();
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
export function resetTaskForm() {
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

  // Cleanup tag picker if it exists
  if (currentTagPickerInstance) {
    currentTagPickerInstance = null;
  }
}

/**
 * Setup modal event listeners
 */
export function setupModalListeners(reloadTasks) {
  // Task form submission
  const taskFormSubmit = document.getElementById('taskFormSubmit');
  if (taskFormSubmit) {
    taskFormSubmit.addEventListener('click', () => submitTaskForm(reloadTasks));
  }

  // Delete confirmation
  const confirmDeleteBtn = document.getElementById('confirmDeleteTaskBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => confirmDelete(reloadTasks));
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
    });
  }
}

// Expose openViewModal to window for other modules
window.openViewModal = openViewModal;
