/**
 * Tasks Modals - Edit Modal
 * Handles task editing modal operations
 */

import { Modal } from 'bootstrap';
import { taskService } from '@services/task-service.js';
import { initTagPicker } from '@tasks/components/tag-picker.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import {
  loadTaskAttachments,
  setEditingTaskId as setAttachmentTaskId,
} from './tasks-attachments.js';
import { renderTaskDependencies } from './tasks-dependencies.js';
import { formatDateDMY } from './tasks-utils.js';
import { initDatePickers } from './tasks-modal-create.js';

/**
 * Open edit task modal
 */
export async function openEditModal(
  taskId,
  setCurrentEditingTaskId,
  currentTagPickerInstance,
  setCurrentTagPicker,
  openDeleteModal
) {
  try {
    console.log('🔧 Opening edit modal for task:', taskId);
    uiHelpers.showLoading('Loading task...');
    const task = await taskService.getTask(taskId);
    console.log('✅ Task data loaded:', task);
    uiHelpers.hideLoading();

    setCurrentEditingTaskId(taskId);
    setAttachmentTaskId(taskId);

    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const projectInput = document.getElementById('taskProject');
    const priorityInput = document.getElementById('taskPriority');
    const assigneeInput = document.getElementById('taskAssignee');
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
    if (assigneeInput) assigneeInput.value = task.assigned_to || '';
    // Format dates to DD-MM-YYYY for display
    if (startDateInput) startDateInput.value = formatDateDMY(task.start_date);
    if (dueDateInput) dueDateInput.value = formatDateDMY(task.due_date);
    if (title) title.textContent = 'Edit Task';
    if (submit) submit.textContent = 'Save Changes';
    if (deleteBtn) {
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.onclick = () => openDeleteModal(taskId);
    }

    // Initialize date pickers after setting values
    initDatePickers();

    // Show tags section and initialize tag picker
    if (tagsSection) {
      tagsSection.style.display = 'block';

      try {
        // Cleanup previous instance if it exists
        if (currentTagPickerInstance) {
          currentTagPickerInstance.destroy();
          setCurrentTagPicker(null);
        }

        const tagPickerContainer = document.getElementById('taskTagPicker');
        if (tagPickerContainer) {
          const newTagPicker = await initTagPicker(tagPickerContainer, taskId);
          setCurrentTagPicker(newTagPicker);
        }
      } catch (error) {
        console.error('Error initializing tag picker:', error);
      }
    }

    // Show attachments section and load attachments
    if (attachmentsSection) {
      attachmentsSection.style.display = 'block';
      try {
        await loadTaskAttachments(taskId);
      } catch (error) {
        console.error('Error loading attachments:', error);
      }
    }

    // Show dependencies section and load dependencies
    if (dependenciesSection) {
      dependenciesSection.style.display = 'block';
      try {
        await renderTaskDependencies(taskId);
      } catch (error) {
        console.error('Error loading dependencies:', error);
      }
    }

    console.log('📝 Opening modal...');
    const modal = new Modal(document.getElementById('taskModal'));
    modal.show();
    console.log('✅ Modal opened successfully');
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error loading task:', error);
    uiHelpers.showError('Failed to load task details');
  }
}
