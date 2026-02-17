/**
 * Projects Forms - Modal & Form Logic
 * Handles create/edit/delete modals and form submissions
 */

import { Modal } from 'bootstrap';
import { uiHelpers } from '@utils/ui-helpers.js';
import { projectService } from '@services/project-service.js';

/**
 * Open create project modal
 */
export function openCreateModal(currentEditingProjectId) {
  currentEditingProjectId.value = null;
  resetProjectForm();

  const title = document.getElementById('projectModalTitle');
  const submit = document.getElementById('projectFormSubmit');
  const archivedOption = document.getElementById('archivedOption');

  if (title) title.textContent = 'Create Project';
  if (submit) submit.textContent = 'Create Project';

  // Hide archived option when creating new project
  if (archivedOption) archivedOption.style.display = 'none';

  const modal = new Modal(document.getElementById('projectModal'));
  modal.show();
}

/**
 * Open edit project modal
 */
export function openEditModal(projectId, projects, currentEditingProjectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentEditingProjectId.value = projectId;

  const nameInput = document.getElementById('projectName');
  const descInput = document.getElementById('projectDescription');
  const statusInput = document.getElementById('projectStatus');
  const startYearInput = document.getElementById('projectStartYear');
  const endYearInput = document.getElementById('projectEndYear');
  const title = document.getElementById('projectModalTitle');
  const submit = document.getElementById('projectFormSubmit');
  const archivedOption = document.getElementById('archivedOption');

  if (nameInput) nameInput.value = project.name;
  if (descInput) descInput.value = project.description || '';
  if (statusInput) statusInput.value = project.status;
  if (startYearInput) startYearInput.value = project.start_year || '';
  if (endYearInput) endYearInput.value = project.end_year || '';
  if (title) title.textContent = 'Edit Project';
  if (submit) submit.textContent = 'Save Changes';

  // Show archived option when editing
  if (archivedOption) archivedOption.style.display = '';

  const modal = new Modal(document.getElementById('projectModal'));
  modal.show();
}

/**
 * Open delete confirmation modal
 */
export function openDeleteModal(projectId, projects, currentDeletingProjectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentDeletingProjectId.value = projectId;

  const projectName = document.getElementById('deleteProjectName');
  if (projectName) projectName.textContent = project.name;

  const modal = new Modal(document.getElementById('deleteProjectModal'));
  modal.show();
}

/**
 * Submit project form
 */
export async function submitProjectForm(currentEditingProjectId, onSuccess) {
  try {
    const nameInput = document.getElementById('projectName');
    const descInput = document.getElementById('projectDescription');
    const statusInput = document.getElementById('projectStatus');
    const errorsDiv = document.getElementById('projectFormErrors');

    // Clear previous errors
    if (errorsDiv) errorsDiv.innerHTML = '';

    // Validate
    const errors = {};
    if (!nameInput.value.trim()) {
      errors.name = 'Project name is required';
    } else if (nameInput.value.length > 100) {
      errors.name = 'Project name must be 100 characters or less';
    }

    if (Object.keys(errors).length > 0) {
      uiHelpers.showFormErrors(errors);
      return;
    }

    const submitBtn = document.getElementById('projectFormSubmit');
    uiHelpers.disableButton(submitBtn, 'Saving...');

    const startYearInput = document.getElementById('projectStartYear');
    const endYearInput = document.getElementById('projectEndYear');

    const projectData = {
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      status: statusInput.value,
      start_year: startYearInput.value || null,
      end_year: endYearInput.value || null,
    };

    if (currentEditingProjectId.value) {
      // Update existing project
      await projectService.updateProject(currentEditingProjectId.value, projectData);
      uiHelpers.showSuccess('Project updated successfully');
    } else {
      // Create new project
      await projectService.createProject(projectData);
      uiHelpers.showSuccess('Project created successfully');
    }

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('projectModal'));
    modal.hide();

    await onSuccess();
    uiHelpers.enableButton(submitBtn);
  } catch (error) {
    console.error('Error submitting project form:', error);
    uiHelpers.showFormErrors({ general: error.message || 'Failed to save project' });
    const submitBtn = document.getElementById('projectFormSubmit');
    uiHelpers.enableButton(submitBtn);
  }
}

/**
 * Confirm project deletion
 */
export async function confirmDelete(currentDeletingProjectId, onSuccess) {
  try {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    uiHelpers.disableButton(confirmBtn, 'Deleting...');

    await projectService.deleteProject(currentDeletingProjectId.value);
    uiHelpers.showSuccess('Project deleted successfully');

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('deleteProjectModal'));
    modal.hide();

    await onSuccess();
    uiHelpers.enableButton(confirmBtn);
  } catch (error) {
    console.error('Error deleting project:', error);
    uiHelpers.showError('Failed to delete project. Please try again.');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    uiHelpers.enableButton(confirmBtn);
  }
}

/**
 * Reset project form
 */
export function resetProjectForm() {
  const form = document.getElementById('projectForm');
  if (form) form.reset();

  const errorsDiv = document.getElementById('projectFormErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  const statusInput = document.getElementById('projectStatus');
  if (statusInput) statusInput.value = 'active';
}

/**
 * Bulk delete selected projects
 */
export async function bulkDeleteProjects(onSuccess) {
  const checkboxes = document.querySelectorAll('.project-checkbox:checked');
  const selectedIds = Array.from(checkboxes).map((cb) => parseInt(cb.dataset.projectId, 10));

  if (selectedIds.length === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete ${selectedIds.length} project${selectedIds.length !== 1 ? 's' : ''}?\n\n` +
    'This action cannot be undone. All tasks in these projects will also be deleted.'
  );

  if (!confirmed) return;

  try {
    uiHelpers.showLoading(`Deleting ${selectedIds.length} project${selectedIds.length !== 1 ? 's' : ''}...`);

    // Delete each project
    for (const projectId of selectedIds) {
      await projectService.deleteProject(projectId);
    }

    uiHelpers.showSuccess(`Successfully deleted ${selectedIds.length} project${selectedIds.length !== 1 ? 's' : ''}`);
    uiHelpers.hideLoading();
    await onSuccess();
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error bulk deleting projects:', error);
    uiHelpers.showError('Failed to delete projects. Please try again.');
  }
}
