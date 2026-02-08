/**
 * Projects Page Logic
 * Handles project CRUD operations and UI interactions
 */

import { renderNavbar } from '../components/navbar.js';
import { requireAuth } from '../utils/router.js';
import { getUserMetadata, getCurrentUser } from '../utils/auth.js';
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
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from '../services/project-service.js';

// State
let projects = [];
let currentEditingProjectId = null;
let currentDeletingProjectId = null;
let currentUser = null;

/**
 * Initialize the projects page
 */
async function init() {
  try {
    // Require authentication
    await requireAuth();

    // Render navbar
    await renderNavbar();

    // Load current user
    currentUser = await getCurrentUser();

    // Load projects
    await loadProjects();

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Projects page initialization error:', error);
    showError('Failed to load projects page. Please refresh.');
  }
}

/**
 * Load projects from the API
 */
async function loadProjects() {
  try {
    showLoading('Loading projects...');
    projects = await getProjects();
    hideLoading();
    renderProjects();
  } catch (error) {
    hideLoading();
    console.error('Error loading projects:', error);
    showError('Failed to load projects. Please try again.');
  }
}

/**
 * Render projects grid
 */
function renderProjects() {
  const container = document.getElementById('projectsContainer');
  const filterStatus = document.getElementById('statusFilter').value;

  // Filter projects
  let filteredProjects = projects;
  if (filterStatus) {
    filteredProjects = projects.filter((p) => p.status === filterStatus);
  }

  // Show empty state if no projects
  if (filteredProjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <h3 class="empty-state-title">No projects yet</h3>
        <p class="empty-state-message">
          ${filterStatus ? 'No projects with this status. ' : ''}
          Create your first project to get started.
        </p>
        <button class="btn btn-primary" id="emptyStateCreateBtn">Create Project</button>
      </div>
    `;

    const emptyStateBtn = document.getElementById('emptyStateCreateBtn');
    if (emptyStateBtn) {
      emptyStateBtn.addEventListener('click', openCreateModal);
    }
    return;
  }

  // Render projects grid
  container.innerHTML = filteredProjects
    .map((project) => renderProjectCard(project))
    .join('');

  // Attach event listeners to cards
  container.querySelectorAll('.project-card-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const projectId = btn.dataset.projectId;
      openEditModal(projectId);
    });
  });

  container.querySelectorAll('.project-card-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const projectId = btn.dataset.projectId;
      openDeleteModal(projectId);
    });
  });

  // Attach click to open project details
  container.querySelectorAll('[class*="project-card"]:not(.project-card-edit):not(.project-card-delete)').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.project-card-actions')) {
        const projectId = card.dataset.projectId;
        openProjectDetails(projectId);
      }
    });
  });
}

/**
 * Render a single project card
 */
function renderProjectCard(project) {
  const statusBadgeClass = `project-status ${project.status}`;
  const taskCount = project.tasks?.[0]?.count || 0;

  return `
    <div class="card project-card" data-project-id="${project.id}">
      <div class="project-icon">📁</div>
      <a href="#" class="project-name">${escapeHtml(project.name)}</a>
      ${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ''}

      <div class="project-meta">
        <span class="project-status ${project.status}">${capitalizeFirst(project.status)}</span>
        <span class="project-tasks">${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
      </div>

      <div class="project-card-actions">
        <button class="btn btn-sm btn-outline-primary project-card-edit" data-project-id="${project.id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger project-card-delete" data-project-id="${project.id}">Delete</button>
      </div>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // New project button
  const newProjectBtn = document.getElementById('newProjectBtn');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', openCreateModal);
  }

  // Status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', renderProjects);
  }

  // Project form submission
  const projectFormSubmit = document.getElementById('projectFormSubmit');
  if (projectFormSubmit) {
    projectFormSubmit.addEventListener('click', submitProjectForm);
  }

  // Modal close cleanup
  const projectModal = document.getElementById('projectModal');
  if (projectModal) {
    projectModal.addEventListener('hidden.bs.modal', resetProjectForm);
  }

  // Delete confirmation
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }
}

/**
 * Open create project modal
 */
function openCreateModal() {
  currentEditingProjectId = null;
  resetProjectForm();

  const title = document.getElementById('projectModalTitle');
  const submit = document.getElementById('projectFormSubmit');

  if (title) title.textContent = 'Create Project';
  if (submit) submit.textContent = 'Create Project';

  const modal = new bootstrap.Modal(document.getElementById('projectModal'));
  modal.show();
}

/**
 * Open edit project modal
 */
function openEditModal(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentEditingProjectId = projectId;

  const nameInput = document.getElementById('projectName');
  const descInput = document.getElementById('projectDescription');
  const statusInput = document.getElementById('projectStatus');
  const title = document.getElementById('projectModalTitle');
  const submit = document.getElementById('projectFormSubmit');

  if (nameInput) nameInput.value = project.name;
  if (descInput) descInput.value = project.description || '';
  if (statusInput) statusInput.value = project.status;
  if (title) title.textContent = 'Edit Project';
  if (submit) submit.textContent = 'Save Changes';

  const modal = new bootstrap.Modal(document.getElementById('projectModal'));
  modal.show();
}

/**
 * Open delete confirmation modal
 */
function openDeleteModal(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentDeletingProjectId = projectId;

  const projectName = document.getElementById('deleteProjectName');
  if (projectName) projectName.textContent = project.name;

  const modal = new bootstrap.Modal(document.getElementById('deleteProjectModal'));
  modal.show();
}

/**
 * Open project details (future: navigate to project page)
 */
function openProjectDetails(projectId) {
  // TODO: Implement project details page
  showError('Project details coming soon');
}

/**
 * Submit project form
 */
async function submitProjectForm() {
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
      showFormErrors(errors);
      return;
    }

    const submitBtn = document.getElementById('projectFormSubmit');
    disableButton(submitBtn, 'Saving...');

    const projectData = {
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      status: statusInput.value,
    };

    if (currentEditingProjectId) {
      // Update existing project
      await updateProject(currentEditingProjectId, projectData);
      showSuccess('Project updated successfully');
    } else {
      // Create new project
      await createProject(projectData);
      showSuccess('Project created successfully');
    }

    // Close modal and reload
    const modal = bootstrap.Modal.getInstance(document.getElementById('projectModal'));
    modal.hide();

    await loadProjects();
    enableButton(submitBtn);
  } catch (error) {
    console.error('Error submitting project form:', error);
    showFormErrors({ general: error.message || 'Failed to save project' });
    const submitBtn = document.getElementById('projectFormSubmit');
    enableButton(submitBtn);
  }
}

/**
 * Confirm project deletion
 */
async function confirmDelete() {
  try {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    disableButton(confirmBtn, 'Deleting...');

    await deleteProject(currentDeletingProjectId);
    showSuccess('Project deleted successfully');

    // Close modal and reload
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteProjectModal'));
    modal.hide();

    await loadProjects();
    enableButton(confirmBtn);
  } catch (error) {
    console.error('Error deleting project:', error);
    showError('Failed to delete project. Please try again.');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    enableButton(confirmBtn);
  }
}

/**
 * Reset project form
 */
function resetProjectForm() {
  const form = document.getElementById('projectForm');
  if (form) form.reset();

  const errorsDiv = document.getElementById('projectFormErrors');
  if (errorsDiv) errorsDiv.innerHTML = '';

  const statusInput = document.getElementById('projectStatus');
  if (statusInput) statusInput.value = 'active';

  currentEditingProjectId = null;
}

/**
 * Escape HTML special characters
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

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize on page load
init();
