/**
 * Projects Page Logic
 * Handles project CRUD operations and UI interactions
 */

import { Modal } from 'bootstrap';
import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { projectService } from '@services/project-service.js';
import { realtimeService } from '@services/realtime-service.js';

// State
let projects = [];
let currentEditingProjectId = null;
let currentDeletingProjectId = null;
let currentUser = null;
let isAdmin = false;
let realtimeSubscriptionId = null;

/**
 * Initialize the projects page
 */
async function init() {
  try {
    // Require authentication
    await router.requireAuth();

    // Render navbar
    await renderNavbar();

    // Load current user
    currentUser = await authUtils.getCurrentUser();

    // Check if user is admin
    isAdmin = await authUtils.isCompanyAdmin();

    // Load projects
    await loadProjects();

    // Setup event listeners
    setupEventListeners();

    // Populate year filter
    populateYearFilter();

    // Subscribe to real-time updates
    await setupRealtimeSubscription();
  } catch (error) {
    console.error('Projects page initialization error:', error);
    uiHelpers.showError('Failed to load projects page. Please refresh.');
  }
}

/**
 * Load projects from the API
 */
async function loadProjects() {
  try {
    uiHelpers.showLoading('Loading projects...');
    // Request task counts for the projects page
    projects = await projectService.getProjects({ includeTaskCounts: true });
    uiHelpers.hideLoading();
    renderProjects();
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error loading projects:', error);
    uiHelpers.showError('Failed to load projects. Please try again.');
  }
}

/**
 * Render projects grid
 */
function renderProjects() {
  const container = document.getElementById('projectsContainer');
  const filterStatus = document.getElementById('statusFilter').value;
  const filterYear = document.getElementById('yearFilter').value;

  // Filter projects
  let filteredProjects = projects;
  if (filterStatus) {
    filteredProjects = filteredProjects.filter((p) => p.status === filterStatus);
  }
  if (filterYear) {
    const year = parseInt(filterYear);
    filteredProjects = filteredProjects.filter((p) => {
      // Show project if year falls within its range
      const hasStartYear = p.start_year && p.start_year <= year;
      const hasEndYear = p.end_year && p.end_year >= year;
      const noStartYear = !p.start_year;
      const noEndYear = !p.end_year;

      // Include if year is within range or if years are not set
      return (noStartYear || hasStartYear) && (noEndYear || hasEndYear);
    });
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
        ${isAdmin ? '<button class="btn btn-primary" id="emptyStateCreateBtn">Create Project</button>' : ''}
      </div>
    `;

    const emptyStateBtn = document.getElementById('emptyStateCreateBtn');
    if (emptyStateBtn && isAdmin) {
      emptyStateBtn.addEventListener('click', openCreateModal);
    }

    // Clear bulk actions bar when no projects
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    if (bulkActionsBar) {
      bulkActionsBar.classList.add('d-none');
    }
    return;
  }

  // Render projects grid
  container.innerHTML = filteredProjects
    .map((project) => renderProjectCard(project))
    .join('');

  // Attach event listeners to dynamically rendered cards
  attachProjectCardListeners();

  // Update bulk actions bar
  updateBulkActionsBar();
}

/**
 * Attach event listeners to dynamically rendered project cards
 * NOTE: Event listeners are now handled via delegation in setupEventListeners()
 * This function is kept for backward compatibility but does nothing
 */
function attachProjectCardListeners() {
  // Event delegation is set up in setupEventListeners() via handleProjectCardClick
  // No need to attach individual listeners here
}

/**
 * Render a single project card
 */
function renderProjectCard(project) {
  const statusBadgeClass = `project-status ${project.status}`;
  const taskCount = project.tasks?.[0]?.count || 0;
  const yearDisplay = project.start_year || project.end_year
    ? `${project.start_year || '?'} - ${project.end_year || '?'}`
    : '';

  return `
    <div class="card project-card" data-project-id="${project.id}">
      ${isAdmin ? `
      <div class="project-card-checkbox">
        <input type="checkbox" class="project-checkbox" data-project-id="${project.id}" aria-label="Select ${escapeHtml(project.name)}">
      </div>
      ` : ''}

      <div class="project-icon">📁</div>
      <div class="project-name">${escapeHtml(project.name)}</div>
      ${project.description ? `<p class="project-description">${escapeHtml(project.description)}</p>` : ''}
      ${yearDisplay ? `<p class="project-years">📅 ${yearDisplay}</p>` : ''}

      <div class="project-meta">
        <span class="project-status ${project.status}">${capitalizeFirst(project.status)}</span>
        <span class="project-tasks">${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
      </div>

      ${isAdmin ? `
      <div class="project-card-actions">
        <button type="button" class="btn btn-sm btn-outline-primary project-card-edit" data-project-id="${project.id}">Edit</button>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // New project button (admin only)
  const newProjectBtn = document.getElementById('newProjectBtn');
  if (newProjectBtn) {
    if (isAdmin) {
      newProjectBtn.addEventListener('click', openCreateModal);
    } else {
      // Hide the button for non-admins
      newProjectBtn.style.display = 'none';
    }
  }

  // Status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', renderProjects);
  }

  // Year filter
  const yearFilter = document.getElementById('yearFilter');
  if (yearFilter) {
    yearFilter.addEventListener('change', renderProjects);
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

  // Bulk delete button (admin only)
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  if (bulkDeleteBtn) {
    if (isAdmin) {
      bulkDeleteBtn.addEventListener('click', bulkDeleteProjects);
    }
  }

  // Use event delegation for project card actions
  const container = document.getElementById('projectsContainer');
  if (container) {
    container.addEventListener('click', handleProjectCardClick);
    container.addEventListener('change', handleCheckboxChange);
  }
}

/**
 * Handle clicks on project cards using event delegation
 */
function handleProjectCardClick(e) {
  // Handle edit button click (admin only)
  const editBtn = e.target.closest('.project-card-edit');
  if (editBtn && isAdmin) {
    e.preventDefault();
    e.stopPropagation();
    const projectId = parseInt(editBtn.dataset.projectId, 10);
    openEditModal(projectId);
    return;
  }

  // Ignore clicks on checkboxes (handled separately)
  if (e.target.classList.contains('project-checkbox')) {
    return;
  }

  // Handle project card click (open details)
  const projectCard = e.target.closest('.project-card');
  if (projectCard && !e.target.closest('.project-card-actions') && !e.target.closest('.project-card-checkbox')) {
    const projectId = parseInt(projectCard.dataset.projectId, 10);
    openProjectDetails(projectId);
  }
}

/**
 * Handle checkbox changes for bulk selection
 */
function handleCheckboxChange(e) {
  if (e.target.classList.contains('project-checkbox')) {
    updateBulkActionsBar();
  }
}

/**
 * Populate year filter dropdown with available years from projects
 */
function populateYearFilter() {
  const yearFilter = document.getElementById('yearFilter');
  if (!yearFilter) return;

  // Get all unique years from projects
  const years = new Set();
  projects.forEach((project) => {
    if (project.start_year) years.add(project.start_year);
    if (project.end_year) years.add(project.end_year);
  });

  // Convert to sorted array
  const sortedYears = Array.from(years).sort((a, b) => b - a);

  // Clear existing options except the first "All Years"
  yearFilter.innerHTML = '<option value="">All Years</option>';

  // Add year options
  sortedYears.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearFilter.appendChild(option);
  });
}

/**
 * Update bulk actions bar visibility and selected count
 */
function updateBulkActionsBar() {
  const checkboxes = document.querySelectorAll('.project-checkbox:checked');
  const bulkActionsBar = document.getElementById('bulkActionsBar');
  const selectionCount = document.getElementById('selectionCount');

  if (checkboxes.length > 0) {
    bulkActionsBar.classList.remove('d-none');
    selectionCount.textContent = `${checkboxes.length} project${checkboxes.length !== 1 ? 's' : ''} selected`;
  } else {
    bulkActionsBar.classList.add('d-none');
    selectionCount.textContent = '';
  }
}

/**
 * Bulk delete selected projects
 */
async function bulkDeleteProjects() {
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
    await loadProjects();
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error bulk deleting projects:', error);
    uiHelpers.showError('Failed to delete projects. Please try again.');
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
function openEditModal(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentEditingProjectId = projectId;

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
function openDeleteModal(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;

  currentDeletingProjectId = projectId;

  const projectName = document.getElementById('deleteProjectName');
  if (projectName) projectName.textContent = project.name;

  const modal = new Modal(document.getElementById('deleteProjectModal'));
  modal.show();
}

/**
 * Open project details - Navigate to tasks page for this project
 */
function openProjectDetails(projectId) {
  // Navigate to tasks page filtered by this project
  window.location.href = `/public/tasks.html?project=${projectId}`;
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

    if (currentEditingProjectId) {
      // Update existing project
      await projectService.updateProject(currentEditingProjectId, projectData);
      uiHelpers.showSuccess('Project updated successfully');
    } else {
      // Create new project
      await projectService.createProject(projectData);
      uiHelpers.showSuccess('Project created successfully');
    }

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('projectModal'));
    modal.hide();

    await loadProjects();
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
async function confirmDelete() {
  try {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    uiHelpers.disableButton(confirmBtn, 'Deleting...');

    await projectService.deleteProject(currentDeletingProjectId);
    uiHelpers.showSuccess('Project deleted successfully');

    // Close modal and reload
    const modal = Modal.getInstance(document.getElementById('deleteProjectModal'));
    modal.hide();

    await loadProjects();
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

/**
 * Setup realtime subscription for projects
 */
async function setupRealtimeSubscription() {
  try {
    console.log('📡 Setting up projects realtime subscription...');
    realtimeSubscriptionId = await realtimeService.subscribeToProjects(
      // On insert
      (newProject) => {
        console.log('📡 New project created:', newProject);
        loadProjects();
      },
      // On update
      (updatedProject, oldProject) => {
        console.log('📡 Project updated:', updatedProject);
        loadProjects();
      },
      // On delete
      (deletedProject) => {
        console.log('📡 Project deleted:', deletedProject);
        loadProjects();
      }
    );
    console.log('✅ Projects realtime subscription active:', realtimeSubscriptionId);
  } catch (error) {
    console.error('❌ Error setting up projects realtime subscription:', error);
  }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
  console.log('🧹 Cleaning up projects realtime subscription...');
  realtimeService.unsubscribeAll();
});

// Initialize on page load
init();
