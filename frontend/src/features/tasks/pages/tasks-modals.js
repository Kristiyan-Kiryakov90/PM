/**
 * Task Modals Module - Main Orchestrator
 * Coordinates create, edit, view, and delete modal operations
 */

import { Modal } from 'bootstrap';
import { taskService } from '@services/task-service.js';
import { teamService } from '@services/team-service.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { handleAttachmentUpload } from './tasks-attachments.js';
import { parseDateDMY } from './tasks-utils.js';

// Import modal modules
import {
  openCreateModal as openCreateModalImpl,
  resetTaskForm as resetTaskFormImpl,
  startDatePicker,
  dueDatePicker
} from './tasks-modal-create.js';
import { openEditModal as openEditModalImpl } from './tasks-modal-edit.js';
import {
  openViewModal as openViewModalImpl,
  openDeleteModal as openDeleteModalImpl
} from './tasks-modal-view.js';

// Modal state
let currentEditingTaskId = null;
let currentDeletingTaskId = null;
let currentTagPickerInstance = null;
let currentUser = null;
let teamMembers = [];

/**
 * Initialize modals module
 * If preloadedMembers is provided, skips the DB fetch for team members.
 */
export async function initModalsModule(user, preloadedMembers = null) {
  currentUser = user;
  if (preloadedMembers) {
    teamMembers = preloadedMembers;
    populateAssigneeDropdown();
  } else {
    await loadTeamMembers();
  }
}

/**
 * Load team members for assignment dropdown
 */
async function loadTeamMembers() {
  try {
    teamMembers = await teamService.getTeamMembers();
    populateAssigneeDropdown();
  } catch (error) {
    console.error('Error loading team members:', error);
    teamMembers = [];
  }
}

/**
 * Populate assignee dropdown with team members
 */
function populateAssigneeDropdown() {
  const assigneeSelect = document.getElementById('taskAssignee');
  if (!assigneeSelect) return;

  // Keep current selection
  const currentValue = assigneeSelect.value;

  // Reset dropdown
  assigneeSelect.innerHTML = '<option value="">Unassigned</option>';

  // Add team members
  teamMembers.forEach((member) => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = member.full_name || member.email || 'Unknown User';
    assigneeSelect.appendChild(option);
  });

  // Restore previous selection if it exists
  if (currentValue) {
    assigneeSelect.value = currentValue;
  }
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
  openCreateModalImpl(() => resetTaskForm());
}

/**
 * Open edit task modal
 */
export async function openEditModal(taskId) {
  await openEditModalImpl(
    taskId,
    (id) => { currentEditingTaskId = id; },
    currentTagPickerInstance,
    (instance) => { currentTagPickerInstance = instance; },
    (id) => openDeleteModal(id)
  );
}

/**
 * Open view task modal
 */
export async function openViewModal(taskId) {
  await openViewModalImpl(
    taskId,
    teamMembers,
    currentUser,
    openEditModal,
    (id) => { currentDeletingTaskId = id; }
  );
}

/**
 * Open delete confirmation modal
 */
export function openDeleteModal(taskId, tasks) {
  openDeleteModalImpl(
    taskId,
    tasks,
    (id) => { currentDeletingTaskId = id; }
  );
}

/**
 * Submit task form
 */
export async function submitTaskForm(reloadTasks) {
  console.log('💾 Submitting task form...');
  try {
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const projectInput = document.getElementById('taskProject');
    const priorityInput = document.getElementById('taskPriority');
    const assigneeInput = document.getElementById('taskAssignee');
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
      const startDateISO = parseDateDMY(startDateInput.value);
      const dueDateISO = parseDateDMY(dueDateInput.value);
      if (startDateISO && dueDateISO) {
        const startDate = new Date(startDateISO);
        const dueDate = new Date(dueDateISO);
        if (dueDate < startDate) {
          errors.due_date = 'Due date must be after start date';
        }
      } else {
        // Invalid date format
        if (startDateInput.value && !startDateISO) {
          errors.start_date = 'Invalid date format. Use DD-MM-YYYY';
        }
        if (dueDateInput.value && !dueDateISO) {
          errors.due_date = 'Invalid date format. Use DD-MM-YYYY';
        }
      }
    }

    // Project is optional - tasks can exist without a project

    if (Object.keys(errors).length > 0) {
      uiHelpers.showFormErrors(errors);
      return;
    }

    const submitBtn = document.getElementById('taskFormSubmit');
    uiHelpers.disableButton(submitBtn, 'Saving...');

    const taskData = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      project_id: projectInput.value || null, // Allow null for tasks without projects
      priority: priorityInput.value,
      assigned_to: assigneeInput.value || null,
      start_date: parseDateDMY(startDateInput.value),
      due_date: parseDateDMY(dueDateInput.value),
    };

    if (currentEditingTaskId) {
      // Update existing task
      console.log('📝 Updating task:', currentEditingTaskId);
      await taskService.updateTask(currentEditingTaskId, taskData);
      console.log('✅ Task updated successfully');
      uiHelpers.showSuccess('Task updated successfully');
    } else {
      // Create new task
      console.log('➕ Creating new task');
      await taskService.createTask(taskData);
      console.log('✅ Task created successfully');
      uiHelpers.showSuccess('Task created successfully');
    }

    // Close modal and reload
    console.log('🔄 Closing modal and reloading...');
    const modal = Modal.getInstance(document.getElementById('taskModal'));
    modal.hide();
    console.log('✅ Modal closed');

    console.log('🔄 Reloading tasks...');
    await reloadTasks();
    console.log('✅ Tasks reloaded, re-enabling button');
    uiHelpers.enableButton(submitBtn);
  } catch (error) {
    console.error('Error submitting task form:', error);
    uiHelpers.showFormErrors({ general: error.message || 'Failed to save task' });
    const submitBtn = document.getElementById('taskFormSubmit');
    uiHelpers.enableButton(submitBtn);
  }
}

/**
 * Confirm task deletion
 */
export async function confirmDelete(reloadTasks) {
  try {
    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    uiHelpers.disableButton(confirmBtn, 'Deleting...');

    await taskService.deleteTask(currentDeletingTaskId);
    uiHelpers.showSuccess('Task deleted successfully');

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('deleteTaskModal'));
    modal.hide();

    await reloadTasks();
    uiHelpers.enableButton(confirmBtn);
  } catch (error) {
    console.error('Error deleting task:', error);
    uiHelpers.showError('Failed to delete task. Please try again.');
    const confirmBtn = document.getElementById('confirmDeleteTaskBtn');
    uiHelpers.enableButton(confirmBtn);
  }
}

/**
 * Reset task form
 */
export function resetTaskForm() {
  resetTaskFormImpl(currentTagPickerInstance, (instance) => {
    currentTagPickerInstance = instance;
  });
  currentEditingTaskId = null;
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
