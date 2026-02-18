/**
 * Projects Page Logic
 * Main coordinator for project CRUD operations and UI interactions
 */

// Import styles
import '@styles/global/global.css';
import '@styles/shared/navbar.css';
import '@styles/shared/notifications.css';
import '@projects/styles/projects.css';

import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { projectService } from '@services/project-service.js';
import { realtimeService } from '@services/realtime-service.js';
import {
  renderProjects,
  populateYearFilter,
  updateBulkActionsBar
} from './projects-ui.js';
import {
  openCreateModal,
  openEditModal,
  submitProjectForm,
  confirmDelete,
  resetProjectForm,
  bulkDeleteProjects
} from './projects-forms.js';

// State
let projects = [];
let currentEditingProjectId = { value: null };
let currentDeletingProjectId = { value: null };
let currentUser = null;
let isAdmin = false;
let realtimeSubscriptionId = null;

/**
 * Initialize the projects page
 */
async function init() {
  console.time('⏱️ Projects Page Load');
  try {
    // Require authentication
    await router.requireAuth();

    // Run navbar, auth checks, and data fetch all in parallel
    const [, loadedUser, loadedIsAdmin, loadedProjects] = await Promise.all([
      renderNavbar(),
      authUtils.getCurrentUser(),
      authUtils.isCompanyAdmin(),
      projectService.getProjects({ includeTaskCounts: true }),
    ]);

    currentUser = loadedUser;
    isAdmin = loadedIsAdmin;
    projects = loadedProjects;

    // Render immediately — no overlay needed
    renderProjectsView();

    // Setup event listeners and real-time
    setupEventListeners();
    await setupRealtimeSubscription();

    console.timeEnd('⏱️ Projects Page Load');
  } catch (error) {
    console.error('Projects page initialization error:', error);
    uiHelpers.showError('Failed to load projects page. Please refresh.');
    console.timeEnd('⏱️ Projects Page Load');
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
    renderProjectsView();
  } catch (error) {
    uiHelpers.hideLoading();
    console.error('Error loading projects:', error);
    uiHelpers.showError('Failed to load projects. Please try again.');
  }
}

/**
 * Render projects view (wrapper to call imported renderProjects)
 */
function renderProjectsView() {
  renderProjects(projects, isAdmin, handleCreateModalOpen, handleProjectCardClick);
  populateYearFilter(projects);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // New project button (admin only)
  const newProjectBtn = document.getElementById('newProjectBtn');
  if (newProjectBtn) {
    if (isAdmin) {
      newProjectBtn.addEventListener('click', handleCreateModalOpen);
    } else {
      // Hide the button for non-admins
      newProjectBtn.style.display = 'none';
    }
  }

  // Status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', renderProjectsView);
  }

  // Year filter
  const yearFilter = document.getElementById('yearFilter');
  if (yearFilter) {
    yearFilter.addEventListener('change', renderProjectsView);
  }

  // Project form submission
  const projectFormSubmit = document.getElementById('projectFormSubmit');
  if (projectFormSubmit) {
    projectFormSubmit.addEventListener('click', handleFormSubmit);
  }

  // Modal close cleanup
  const projectModal = document.getElementById('projectModal');
  if (projectModal) {
    projectModal.addEventListener('hidden.bs.modal', resetProjectForm);
  }

  // Delete confirmation
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  }

  // Bulk delete button (admin only)
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  if (bulkDeleteBtn) {
    if (isAdmin) {
      bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    }
  }

  // Use event delegation for project card actions
  const container = document.getElementById('projectsContainer');
  if (container) {
    container.addEventListener('click', handleContainerClick);
    container.addEventListener('change', handleCheckboxChange);
  }
}

/**
 * Handler for create modal open
 */
function handleCreateModalOpen() {
  openCreateModal(currentEditingProjectId);
}

/**
 * Handler for form submission
 */
function handleFormSubmit() {
  submitProjectForm(currentEditingProjectId, loadProjects);
}

/**
 * Handler for delete confirmation
 */
function handleConfirmDelete() {
  confirmDelete(currentDeletingProjectId, loadProjects);
}

/**
 * Handler for bulk delete
 */
function handleBulkDelete() {
  bulkDeleteProjects(loadProjects);
}

/**
 * Handler for container clicks (event delegation)
 */
function handleContainerClick(e) {
  // Call the main handler
  handleProjectCardClick(e);
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
    openEditModal(projectId, projects, currentEditingProjectId);
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
 * Open project details - Navigate to tasks page for this project
 */
function openProjectDetails(projectId) {
  // Navigate to tasks page filtered by this project
  window.location.href = `/public/tasks.html?project=${projectId}`;
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
