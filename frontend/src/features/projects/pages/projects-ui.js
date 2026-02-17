/**
 * Projects UI - Rendering & Display Logic
 * Handles project grid rendering, card templates, and UI updates
 */

/**
 * Escape HTML special characters
 */
export function escapeHtml(text) {
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
export function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Render projects grid
 */
export function renderProjects(projects, isAdmin, onEmptyStateCreate, onCardClick) {
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
      emptyStateBtn.addEventListener('click', onEmptyStateCreate);
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
    .map((project) => renderProjectCard(project, isAdmin))
    .join('');

  // Update bulk actions bar
  updateBulkActionsBar();
}

/**
 * Render a single project card
 */
export function renderProjectCard(project, isAdmin) {
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
 * Populate year filter dropdown with available years from projects
 */
export function populateYearFilter(projects) {
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
export function updateBulkActionsBar() {
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
