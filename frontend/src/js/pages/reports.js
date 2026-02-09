/**
 * Reports Page Logic
 * Handles analytics, metrics display, and report generation
 * Phase 3D: Reports & Analytics
 */

import { renderNavbar } from '../components/navbar.js';
import { requireAuth } from '../utils/router.js';
import { getCurrentUser } from '../utils/auth.js';
import { showError, showLoading, hideLoading } from '../utils/ui-helpers.js';
import { getProjects } from '../services/project-service.js';
import {
  getTaskCompletionMetrics,
  getStatusDistribution,
  getPriorityDistribution,
  getOverdueMetrics,
  getTimeTrackingSummary,
  getTeamProductivity,
  getDateRangePresets,
  exportToCSV,
} from '../services/reports-service.js';

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
    await requireAuth();
    await renderNavbar();

    currentUser = await getCurrentUser();
    datePresets = getDateRangePresets();

    // Set default filter to last 30 days
    currentFilters.startDate = datePresets.last30Days.startDate;
    currentFilters.endDate = datePresets.last30Days.endDate;

    await loadProjects();
    setupEventListeners();
    await loadAllReports();
  } catch (error) {
    console.error('Reports page initialization error:', error);
    showError('Failed to load reports page');
  }
}

/**
 * Load projects for filter
 */
async function loadProjects() {
  try {
    projects = await getProjects();
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

  await loadAllReports();
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
 * Load all reports
 */
async function loadAllReports() {
  try {
    showLoading('Loading reports...');

    await Promise.all([
      loadMetricsOverview(),
      loadTaskCompletionReport(),
      loadStatusDistribution(),
      loadPriorityDistribution(),
      loadTeamProductivity(),
      loadOverdueTasksReport(),
    ]);

    hideLoading();
  } catch (error) {
    hideLoading();
    console.error('Error loading reports:', error);
    showError('Failed to load some reports');
  }
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
      getTaskCompletionMetrics(filters),
      getOverdueMetrics({ projectId: currentFilters.projectId, userId: currentFilters.userId }),
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

    const metrics = await getTaskCompletionMetrics(filters);
    const container = document.getElementById('taskCompletionContent');

    if (metrics.total === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">📭</div><p class="report-empty-text">No tasks found for the selected filters</p></div>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <div class="progress-bar-container" style="margin-bottom: 1rem;">
          <span style="min-width: 80px; font-size: 0.875rem; color: var(--gray-600);">Completed</span>
          <div class="progress-bar">
            <div class="progress-bar-fill success" style="width: ${metrics.completionRate}%"></div>
          </div>
          <span class="progress-label">${metrics.completionRate}%</span>
        </div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
            <th>Visual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="status-badge done">Done</span></td>
            <td>${metrics.completed}</td>
            <td>${metrics.completionRate}%</td>
            <td>
              <div class="progress-bar" style="width: 150px;">
                <div class="progress-bar-fill success" style="width: ${metrics.completionRate}%"></div>
              </div>
            </td>
          </tr>
          <tr>
            <td><span class="status-badge in-progress">In Progress</span></td>
            <td>${metrics.inProgress}</td>
            <td>${metrics.total > 0 ? ((metrics.inProgress / metrics.total) * 100).toFixed(1) : 0}%</td>
            <td>
              <div class="progress-bar" style="width: 150px;">
                <div class="progress-bar-fill" style="width: ${metrics.total > 0 ? ((metrics.inProgress / metrics.total) * 100) : 0}%"></div>
              </div>
            </td>
          </tr>
          <tr>
            <td><span class="status-badge todo">To Do</span></td>
            <td>${metrics.todo}</td>
            <td>${metrics.total > 0 ? ((metrics.todo / metrics.total) * 100).toFixed(1) : 0}%</td>
            <td>
              <div class="progress-bar" style="width: 150px;">
                <div class="progress-bar-fill" style="width: ${metrics.total > 0 ? ((metrics.todo / metrics.total) * 100) : 0}%; background: #6b7280;"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
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

    const distribution = await getStatusDistribution(filters);
    const container = document.getElementById('statusDistributionContent');

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">📭</div><p class="report-empty-text">No tasks found</p></div>';
      return;
    }

    const rows = Object.entries(distribution).map(([status, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      const displayStatus = status.replace('_', ' ');
      return `
        <tr>
          <td>${displayStatus}</td>
          <td>${count}</td>
          <td>${percentage}%</td>
          <td>
            <div class="progress-bar" style="width: 200px;">
              <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
            <th>Percentage</th>
            <th>Distribution</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
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

    const distribution = await getPriorityDistribution(filters);
    const container = document.getElementById('priorityDistributionContent');

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">📭</div><p class="report-empty-text">No tasks found</p></div>';
      return;
    }

    const priorityColors = {
      urgent: '#ef4444',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280',
    };

    const rows = Object.entries(distribution).map(([priority, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      return `
        <tr>
          <td style="text-transform: capitalize;">${priority}</td>
          <td>${count}</td>
          <td>${percentage}%</td>
          <td>
            <div class="progress-bar" style="width: 200px;">
              <div class="progress-bar-fill" style="width: ${percentage}%; background: ${priorityColors[priority]}"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="report-table">
        <thead>
          <tr>
            <th>Priority</th>
            <th>Count</th>
            <th>Percentage</th>
            <th>Distribution</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
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

    const summary = await getTimeTrackingSummary(filters);
    const container = document.getElementById('timeTrackingContent');

    if (summary.entryCount === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">⏱️</div><p class="report-empty-text">No time entries found</p></div>';
      return;
    }

    const projectRows = summary.byProject.map(project => {
      const hours = (project.totalSeconds / 3600).toFixed(2);
      return `
        <tr>
          <td>${project.name}</td>
          <td>${hours}h</td>
          <td>${((project.totalSeconds / summary.totalSeconds) * 100).toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <p style="font-size: 0.875rem; color: var(--gray-600); margin-bottom: 0.5rem;">
          <strong>Total Time:</strong> ${summary.totalHours} hours across ${summary.entryCount} entries
        </p>
      </div>

      ${summary.byProject.length > 0 ? `
        <table class="report-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Time Spent</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${projectRows}
          </tbody>
        </table>
      ` : '<p class="text-muted">No project breakdown available</p>'}
    `;
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

    const productivity = await getTeamProductivity(filters);
    const container = document.getElementById('teamProductivityContent');

    if (productivity.length === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">👥</div><p class="report-empty-text">No team data found</p></div>';
      return;
    }

    const rows = productivity.map(user => `
      <tr>
        <td>${user.userId === 'unassigned' ? 'Unassigned' : user.userId}</td>
        <td>${user.total}</td>
        <td>${user.completed}</td>
        <td>${user.inProgress}</td>
        <td>${user.todo}</td>
        <td>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: 100px;">
              <div class="progress-bar-fill success" style="width: ${user.completionRate}%"></div>
            </div>
            <span class="progress-label">${user.completionRate}%</span>
          </div>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="report-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Total</th>
            <th>Completed</th>
            <th>In Progress</th>
            <th>To Do</th>
            <th>Completion Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
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

    const overdue = await getOverdueMetrics(filters);
    const container = document.getElementById('overdueTasksContent');

    if (overdue.total === 0) {
      container.innerHTML = '<div class="report-empty"><div class="report-empty-icon">✅</div><p class="report-empty-text">No overdue tasks - great job!</p></div>';
      return;
    }

    const rows = overdue.tasks.map(task => {
      const dueDate = new Date(task.due_date);
      const daysOverdue = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));

      return `
        <tr>
          <td>${task.title}</td>
          <td style="text-transform: capitalize;">${task.priority}</td>
          <td>${dueDate.toLocaleDateString()}</td>
          <td>${daysOverdue} days</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <p style="font-size: 0.875rem; color: var(--gray-600);">
          <strong>${overdue.total}</strong> overdue tasks (${overdue.byPriority.urgent} urgent, ${overdue.byPriority.high} high priority)
        </p>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Days Overdue</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading overdue tasks report:', error);
  }
}

/**
 * Export full report to PDF directly (no print dialog)
 */
async function exportReportToPdf() {
  try {
    showLoading('Generating PDF...');

    // Hide elements that shouldn't appear in PDF
    const exportBtn = document.querySelector('.export-pdf-container');
    const filters = document.querySelector('.reports-filters');

    const exportBtnDisplay = exportBtn?.style.display;
    const filtersDisplay = filters?.style.display;

    if (exportBtn) exportBtn.style.display = 'none';
    if (filters) filters.style.display = 'none';

    // Get the reports container
    const element = document.querySelector('.reports-container');

    // Wait a brief moment for the hide to take effect
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    // Create PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add new pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Generate filename with current date
    const filename = `TaskFlow-Report-${new Date().toISOString().split('T')[0]}.pdf`;

    // Save the PDF
    pdf.save(filename);

    // Restore hidden elements
    if (exportBtn) exportBtn.style.display = exportBtnDisplay;
    if (filters) filters.style.display = filtersDisplay;

    hideLoading();

  } catch (error) {
    console.error('Error generating PDF:', error);

    // Restore hidden elements in case of error
    const exportBtn = document.querySelector('.export-pdf-container');
    const filters = document.querySelector('.reports-filters');
    if (exportBtn) exportBtn.style.display = '';
    if (filters) filters.style.display = '';

    hideLoading();
    showError('Failed to generate PDF. Please try again.');
  }
}

// Initialize on page load
init();
