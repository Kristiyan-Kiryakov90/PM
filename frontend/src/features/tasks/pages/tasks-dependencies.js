/**
 * Task Dependencies Module
 * Handles task dependency operations
 */

import { Modal } from 'bootstrap';
import { ganttService } from '@services/gantt-service.js';
import { taskService } from "@services/task-service.js";
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml } from './tasks-utils.js';

/**
 * Render task dependencies in edit modal
 */
export async function renderTaskDependencies(taskId) {
  const container = document.getElementById('taskDependencies');
  if (!container) return;

  try {
    const deps = await ganttService.getDependencies(taskId);

    if (deps.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">No dependencies</p>';
      return;
    }

    container.innerHTML = deps.map(dep => `
      <div class="dependency-item">
        <span>${escapeHtml(dep.depends_on_task.title)}</span>
        <button type="button" class="btn btn-sm btn-link text-danger remove-dependency-btn"
                data-task-id="${taskId}"
                data-depends-on-id="${dep.depends_on_task_id}">
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
 * Handle add dependency button click
 * Note: Loads tasks directly from API to avoid issues with filtered task arrays
 */
export async function handleAddDependencyClick(currentEditingTaskId) {
  try {
    if (!currentEditingTaskId) {
      console.error('No task selected for adding dependency');
      uiHelpers.showError('No task selected. Please edit a task first.');
      return;
    }

    uiHelpers.showLoading('Loading tasks...');

    // Load the current task directly from API to get accurate data
    const task = await taskService.getTask(currentEditingTaskId);

    if (!task) {
      uiHelpers.hideLoading();
      console.error('Task not found:', currentEditingTaskId);
      uiHelpers.showError('Task not found. Please refresh and try again.');
      return;
    }

    // Task must be in a project to have dependencies
    if (!task.project_id) {
      uiHelpers.hideLoading();
      uiHelpers.showError('Dependencies can only be added to tasks within a project');
      return;
    }

    // Load ALL tasks in the same project (unfiltered)
    const allTasks = await taskService.getTasks({ project_id: task.project_id });

    // Filter out the current task
    const projectTasks = allTasks.filter(t => t.id !== currentEditingTaskId);

    uiHelpers.hideLoading();

    if (projectTasks.length === 0) {
      uiHelpers.showError('No other tasks in this project to create dependencies');
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
    uiHelpers.hideLoading();
    console.error('Error preparing dependency modal:', error);
    uiHelpers.showError('Failed to load tasks for dependencies');
  }
}

/**
 * Handle confirm add dependency
 */
export async function handleConfirmAddDependency(currentEditingTaskId, currentView, reloadTasks, renderTaskDependencies) {
  try {
    const select = document.getElementById('dependencyTaskSelect');
    const dependsOnTaskId = parseInt(select?.value);

    if (!dependsOnTaskId || !currentEditingTaskId) {
      uiHelpers.showError('Please select a task');
      return;
    }

    uiHelpers.showLoading('Adding dependency...');
    await ganttService.addDependency({
      task_id: currentEditingTaskId,
      depends_on_task_id: dependsOnTaskId,
      dependency_type: 'finish_to_start'
    });
    uiHelpers.hideLoading();

    uiHelpers.showSuccess('Dependency added');

    // Close modal
    const modal = Modal.getInstance(document.getElementById('dependencyModal'));
    if (modal) modal.hide();

    // Reload dependencies in edit form
    await renderTaskDependencies(currentEditingTaskId);

    // Reload Gantt if in Gantt view
    if (currentView === 'gantt') {
      await reloadTasks();
    }
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error adding dependency:', error);

    if (error.message?.includes('circular')) {
      uiHelpers.showError('Cannot add dependency: Creates a circular dependency chain');
    } else {
      uiHelpers.showError('Failed to add dependency');
    }
  }
}

/**
 * Handle remove dependency
 */
export async function handleRemoveDependency(taskId, dependsOnTaskId, currentView, reloadTasks, renderTaskDependencies) {
  try {
    uiHelpers.showLoading('Removing dependency...');
    await ganttService.removeDependency(taskId, dependsOnTaskId);
    uiHelpers.hideLoading();

    uiHelpers.showSuccess('Dependency removed');

    // Reload dependencies
    await renderTaskDependencies(taskId);

    // Reload Gantt if in Gantt view
    if (currentView === 'gantt') {
      await reloadTasks();
    }
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error removing dependency:', error);
    uiHelpers.showError('Failed to remove dependency');
  }
}
