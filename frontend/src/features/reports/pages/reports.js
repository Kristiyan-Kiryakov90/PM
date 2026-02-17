/**
 * Reports Page Logic
 * Handles analytics, metrics display, and report generation
 * Phase 3D: Reports & Analytics
 * Refactored from 703 lines using modular rendering functions
 */

import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { projectService } from '@services/project-service.js';
import { reportsService } from '@services/reports-service.js';
import {
  renderTaskCompletionMetrics,
  renderStatusDistribution,
  renderPriorityDistribution,
  renderTimeTrackingReport,
  renderTeamProductivity,
  renderOverdueTasksReport,
} from './reports-renderers.js';

// State
let currentFilters = {
  projectId: null,
  userId: null,
  startDate: null,
  endDate: null,
};
let projects = [];
let currentUser = null;
let datePresets = {};

/**
 * Initialize the reports page
 */
async function init() {
  try {
    await router.requireAuth();

    // Set up date presets synchronously before any async work
    datePresets = reportsService.getDateRangePresets();
    currentFilters.startDate = datePresets.last30Days.startDate;
    currentFilters.endDate = datePresets.last30Days.endDate;

    // Run navbar, user fetch, and projects fetch in parallel; fire reports independently
    loadAllReports();
    const [, loadedUser, loadedProjects] = await Promise.all([
      renderNavbar(),
      authUtils.getCurrentUser(),
      projectService.getProjects(),
    ]);

    currentUser = loadedUser;
    projects = loadedProjects;
    populateProjectFilter();
    setupEventListeners();
  } catch (error) {
    console.error('Reports page initialization error:', error);
    uiHelpers.showError('Failed to load reports page');
  }
}

/**
 * Load projects for filter
 */
async function loadProjects() {
  try {
    projects = await projectService.getProjects();
    populateProjectFilter();
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

/**
 * Populate project filter dropdown
 */
function populateProjectFilter() {
  const filterProject = document.getElementById('filterProject');
  if (filterProject) {
    filterProject.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      filterProject.appendChild(option);
    });
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Filter changes
  document.getElementById('filterProject')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterUser')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterStartDate')?.addEventListener('change', handleFilterChange);
  document.getElementById('filterEndDate')?.addEventListener('change', handleFilterChange);

  // Date preset buttons
  document.querySelectorAll('.filter-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyDatePreset(preset);

      // Update active state
      document.querySelectorAll('.filter-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Export PDF button
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportReportToPdf);
}

/**
 * Handle filter changes
 */
async function handleFilterChange() {
  currentFilters.projectId = document.getElementById('filterProject')?.value || null;
  currentFilters.userId = document.getElementById('filterUser')?.value || null;
  currentFilters.startDate = document.getElementById('filterStartDate')?.value || null;
  currentFilters.endDate = document.getElementById('filterEndDate')?.value || null;

  // Clear active preset if manual dates selected
  if (currentFilters.startDate || currentFilters.endDate) {
    document.querySelectorAll('.filter-preset-btn').forEach(btn => btn.classList.remove('active'));
  }

  loadAllReports();
}

/**
 * Apply date preset
 */
function applyDatePreset(preset) {
  if (preset === 'all') {
    currentFilters.startDate = null;
    currentFilters.endDate = null;
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
  } else if (datePresets[preset]) {
    currentFilters.startDate = datePresets[preset].startDate;
    currentFilters.endDate = datePresets[preset].endDate;

    // Update input values
    document.getElementById('filterStartDate').value = new Date(currentFilters.startDate).toISOString().split('T')[0];
    document.getElementById('filterEndDate').value = new Date(currentFilters.endDate).toISOString().split('T')[0];
  }

  loadAllReports();
}

/**
 * Load all reports — progressive rendering, no global spinner.
 * Each section renders independently as its query completes.
 */
function loadAllReports() {
  loadMetricsOverview().catch(err => console.error('Error loading metrics overview:', err));
  loadTaskCompletionReport().catch(err => console.error('Error loading task completion:', err));
  loadStatusDistribution().catch(err => console.error('Error loading status distribution:', err));
  loadPriorityDistribution().catch(err => console.error('Error loading priority distribution:', err));
  loadTeamProductivity().catch(err => console.error('Error loading team productivity:', err));
  loadOverdueTasksReport().catch(err => console.error('Error loading overdue tasks:', err));
}

/**
 * Load metrics overview
 */
async function loadMetricsOverview() {
  try {
    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      projectId: currentFilters.projectId,
      userId: currentFilters.userId,
    };

    const [completion, overdue] = await Promise.all([
      reportsService.getTaskCompletionMetrics(filters),
      reportsService.getOverdueMetrics({ projectId: currentFilters.projectId, userId: currentFilters.userId }),
    ]);

    const metricsGrid = document.getElementById('metricsGrid');
    metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon primary">📊</div>
          <div class="metric-label">Total Tasks</div>
        </div>
        <div class="metric-value">${completion.total}</div>
        <div class="metric-subtitle">${completion.completed} completed</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon success">✅</div>
          <div class="metric-label">Completion Rate</div>
        </div>
        <div class="metric-value">${completion.completionRate}%</div>
        <div class="metric-subtitle">${completion.completed} of ${completion.total} tasks</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon warning">⚠️</div>
          <div class="metric-label">Overdue Tasks</div>
        </div>
        <div class="metric-value">${overdue.total}</div>
        <div class="metric-subtitle">${overdue.byPriority.urgent} urgent</div>
      </div>

      <div class="metric-card">
        <div class="metric-card-header">
          <div class="metric-icon primary">📈</div>
          <div class="metric-label">In Progress</div>
        </div>
        <div class="metric-value">${completion.inProgress}</div>
        <div class="metric-subtitle">Active tasks</div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading metrics overview:', error);
  }
}

/**
 * Load task completion report
 */
async function loadTaskCompletionReport() {
  try {
    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      projectId: currentFilters.projectId,
      userId: currentFilters.userId,
    };

    const metrics = await reportsService.getTaskCompletionMetrics(filters);
    renderTaskCompletionMetrics(metrics);
  } catch (error) {
    console.error('Error loading task completion report:', error);
  }
}

/**
 * Load status distribution
 */
async function loadStatusDistribution() {
  try {
    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      projectId: currentFilters.projectId,
    };

    const distribution = await reportsService.getStatusDistribution(filters);
    renderStatusDistribution(distribution);
  } catch (error) {
    console.error('Error loading status distribution:', error);
  }
}

/**
 * Load priority distribution
 */
async function loadPriorityDistribution() {
  try {
    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      projectId: currentFilters.projectId,
    };

    const distribution = await reportsService.getPriorityDistribution(filters);
    renderPriorityDistribution(distribution);
  } catch (error) {
    console.error('Error loading priority distribution:', error);
  }
}

/**
 * Load time tracking report
 */
async function loadTimeTrackingReport() {
  try {
    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
      projectId: currentFilters.projectId,
      userId: currentFilters.userId,
    };

    const summary = await reportsService.getTimeTrackingSummary(filters);
    renderTimeTrackingReport(summary);
  } catch (error) {
    console.error('Error loading time tracking report:', error);
  }
}

/**
 * Load team productivity
 */
async function loadTeamProductivity() {
  try {
    const companyId = currentUser?.user_metadata?.company_id;

    // Only show for company users
    if (!companyId) {
      document.getElementById('teamProductivitySection').style.display = 'none';
      return;
    }

    document.getElementById('teamProductivitySection').style.display = 'block';

    const filters = {
      startDate: currentFilters.startDate,
      endDate: currentFilters.endDate,
    };

    const productivity = await reportsService.getTeamProductivity(filters);
    renderTeamProductivity(productivity);
  } catch (error) {
    console.error('Error loading team productivity:', error);
  }
}

/**
 * Load overdue tasks report
 */
async function loadOverdueTasksReport() {
  try {
    const filters = {
      projectId: currentFilters.projectId,
      userId: currentFilters.userId,
    };

    const overdue = await reportsService.getOverdueMetrics(filters);
    renderOverdueTasksReport(overdue);
  } catch (error) {
    console.error('Error loading overdue tasks report:', error);
  }
}

/**
 * Export report to PDF (placeholder)
 */
function exportReportToPdf() {
  alert('PDF export feature coming soon! For now, you can print this page (Ctrl+P) and save as PDF.');
}

// Initialize on page load
init();
