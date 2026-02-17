/**
 * Tasks Modals - Create Modal
 * Handles task creation modal operations
 */

import { Modal } from 'bootstrap';

// Shared state (imported from main modals file)
export let startDatePicker = null;
export let dueDatePicker = null;

/**
 * Initialize date pickers for task form
 */
export function initDatePickers() {
  // Destroy existing instances
  if (startDatePicker) {
    startDatePicker.destroy();
    startDatePicker = null;
  }
  if (dueDatePicker) {
    dueDatePicker.destroy();
    dueDatePicker = null;
  }

  // Initialize start date picker
  const startDateInput = document.getElementById('taskStartDate');
  if (startDateInput && typeof flatpickr !== 'undefined') {
    startDatePicker = flatpickr(startDateInput, {
      dateFormat: 'd-m-Y',
      allowInput: true,
      altInput: false,
    });
  }

  // Initialize due date picker
  const dueDateInput = document.getElementById('taskDueDate');
  if (dueDateInput && typeof flatpickr !== 'undefined') {
    dueDatePicker = flatpickr(dueDateInput, {
      dateFormat: 'd-m-Y',
      allowInput: true,
      altInput: false,
    });
  }
}

/**
 * Open create task modal
 */
export function openCreateModal(resetTaskForm) {
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

  // Initialize date pickers
  initDatePickers();

  const modal = new Modal(document.getElementById('taskModal'));
  modal.show();
}

/**
 * Reset task form
 */
export function resetTaskForm(currentTagPickerInstance, setCurrentTagPicker) {
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

  // Cleanup tag picker if it exists
  if (currentTagPickerInstance) {
    currentTagPickerInstance.destroy();
    if (setCurrentTagPicker) setCurrentTagPicker(null);
  }

  // Also clear the tag picker container
  const tagPickerContainer = document.getElementById('taskTagPicker');
  if (tagPickerContainer) {
    tagPickerContainer.innerHTML = '';
  }

  // Cleanup date pickers
  if (startDatePicker) {
    startDatePicker.destroy();
    startDatePicker = null;
  }
  if (dueDatePicker) {
    dueDatePicker.destroy();
    dueDatePicker = null;
  }
}
