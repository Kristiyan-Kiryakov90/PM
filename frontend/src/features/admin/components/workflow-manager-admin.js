/**
 * Workflow Manager Admin Component
 * Allows admins to configure workflow status columns for projects
 */

import { projectService } from '@services/project-service.js';
import { openKanbanSettings } from './kanban-settings.js';
import { uiHelpers } from '@utils/ui-helpers.js';

let currentProjectId = null;

/**
 * Render workflow manager in admin panel
 */
export async function renderWorkflowManager(container) {
  if (!container) {
    console.error('Workflow manager container not found');
    return;
  }

  try {
    // Load active projects
    const projects = await projectService.getProjects({ status: 'active' });

    container.innerHTML = `
      <div class="workflow-manager">
        <div class="mb-4">
          <label for="workflowProjectSelect" class="form-label">Select Project</label>
          <select class="form-select" id="workflowProjectSelect">
            <option value="">Choose a project...</option>
            ${projects.map(p => `
              <option value="${p.id}">${escapeHtml(p.name)}</option>
            `).join('')}
          </select>
          <p class="text-muted mt-2 mb-0" style="font-size: 0.875rem;">
            Select an active project to customize its workflow status columns.
          </p>
        </div>

        <div id="workflowSettingsPlaceholder" style="display: none;">
          <button type="button" class="btn btn-primary" id="openWorkflowSettingsBtn">
            <span>⚙️</span> Configure Workflow
          </button>
        </div>
      </div>
    `;

    // Setup event listeners
    const projectSelect = document.getElementById('workflowProjectSelect');
    const placeholder = document.getElementById('workflowSettingsPlaceholder');
    const openBtn = document.getElementById('openWorkflowSettingsBtn');

    projectSelect.addEventListener('change', (e) => {
      const projectId = parseInt(e.target.value);
      currentProjectId = projectId || null;

      if (currentProjectId) {
        placeholder.style.display = 'block';
      } else {
        placeholder.style.display = 'none';
      }
    });

    openBtn.addEventListener('click', () => {
      if (currentProjectId) {
        openKanbanSettings(currentProjectId);
      } else {
        uiHelpers.showError('Please select a project first');
      }
    });

    // Listen for workflow changes to potentially refresh
    window.addEventListener('kanbanSettingsChanged', () => {
      console.log('Workflow settings changed');
    });

  } catch (error) {
    console.error('Error rendering workflow manager:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <h5>Error Loading Workflow Manager</h5>
        <p>${error.message || 'Failed to load projects'}</p>
      </div>
    `;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
