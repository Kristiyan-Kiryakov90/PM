/**
 * Task Dependencies Module
 * Handles task dependency operations
 */

import { Modal } from 'bootstrap';
import {
  getDependencies,
  addDependency,
  removeDependency,
} from '../services/gantt-service.js';
import { showError, showSuccess, showLoading, hideLoading } from '../utils/ui-helpers.js';
import { escapeHtml } from './tasks-utils.js';

/**
 * Render task dependencies in edit modal
 */
export async function renderTaskDependencies(taskId) {
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
 * Handle add dependency button click
 */
export async function handleAddDependencyClick(currentEditingTaskId, tasks) {
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
export async function handleConfirmAddDependency(currentEditingTaskId, currentView, reloadTasks, renderTaskDependencies) {
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
      await reloadTasks();
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
 * Handle remove dependency
 */
export async function handleRemoveDependency(taskId, dependsOnTaskId, currentView, reloadTasks, renderTaskDependencies) {
  try {
    showLoading('Removing dependency...');
    await removeDependency(taskId, dependsOnTaskId);
    hideLoading();

    showSuccess('Dependency removed');

    // Reload dependencies
    await renderTaskDependencies(taskId);

    // Reload Gantt if in Gantt view
    if (currentView === 'gantt') {
      await reloadTasks();
    }
  } catch (error) {
    hideLoading();
    console.error('Error removing dependency:', error);
    showError('Failed to remove dependency');
  }
}

// Expose to window for onclick handlers
window.handleRemoveDependency = handleRemoveDependency;
