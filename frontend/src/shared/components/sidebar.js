/**
 * Sidebar Component
 * Collapsible navigation showing Spaces → Projects hierarchy
 */

import { getSpacesWithCounts, getProjectsInSpace } from '../services/space-service.js';

/**
 * Render sidebar HTML and inject into page
 * @param {Object} options - { onSpaceClick, onProjectClick, activeProjectId }
 * @returns {Promise<void>}
 */
export async function renderSidebar(options = {}) {
  const {
    onSpaceClick = () => {},
    onProjectClick = () => {},
    activeProjectId = null,
  } = options;

  try {
    // Load spaces with project counts
    const spaces = await getSpacesWithCounts();

    // Load unassigned projects
    const unassignedProjects = await getProjectsInSpace('unassigned');

    const sidebarHTML = `
      <aside class="sidebar" id="projectsSidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Spaces</h2>
          <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M6 9L10 5L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="sidebar-content">
          <!-- Unassigned Projects (always shown if any exist) -->
          ${unassignedProjects.length > 0 ? renderSpaceSection(
            null,
            'Unassigned Projects',
            '📁',
            '#6b7280',
            unassignedProjects,
            activeProjectId,
            false
          ) : ''}

          <!-- Spaces -->
          ${spaces.map(space => {
            // Initial render shows empty spaces, projects loaded on click
            return renderSpaceSection(
              space.id,
              space.name,
              space.icon,
              space.color,
              [], // Empty initially, loaded on expand
              activeProjectId,
              space.project_count || 0
            );
          }).join('')}

          <!-- Empty State -->
          ${spaces.length === 0 && unassignedProjects.length === 0 ? `
            <div class="sidebar-empty">
              <div class="sidebar-empty-icon">📁</div>
              <p class="sidebar-empty-text">No spaces yet</p>
              <button class="btn btn-sm btn-primary" id="createSpaceBtn">
                Create Space
              </button>
            </div>
          ` : ''}
        </div>
      </aside>
    `;

    // Insert sidebar before main content or in designated container
    const container = document.getElementById('sidebarContainer');
    if (container) {
      container.innerHTML = sidebarHTML;
    } else {
      // Insert before main
      const main = document.querySelector('main');
      if (main) {
        main.insertAdjacentHTML('beforebegin', sidebarHTML);
      }
    }

    // Load sidebar CSS if not already loaded
    if (!document.querySelector('link[href*="sidebar.css"]')) {
      const sidebarCSS = document.createElement('link');
      sidebarCSS.rel = 'stylesheet';
      sidebarCSS.href = '/src/styles/shared/sidebar.css';
      document.head.appendChild(sidebarCSS);
    }

    // Setup event listeners
    setupSidebarEvents(onSpaceClick, onProjectClick);
  } catch (error) {
    console.error('Error rendering sidebar:', error);
  }
}

/**
 * Render a space section with projects
 */
function renderSpaceSection(spaceId, spaceName, icon, color, projects, activeProjectId, projectCount) {
  const isUnassigned = spaceId === null;
  const hasProjects = projects.length > 0;
  const spaceIdAttr = spaceId || 'unassigned';
  const countBadge = projectCount > 0 ? `<span class="space-count">${projectCount}</span>` : '';
  const isExpanded = isUnassigned && hasProjects; // Unassigned starts expanded if has projects

  return `
    <div class="space-section ${isUnassigned ? 'space-unassigned' : ''} ${!isExpanded ? 'space-collapsed' : ''}" data-space-id="${spaceIdAttr}">
      <button class="space-header" data-space-id="${spaceIdAttr}">
        <svg class="space-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 5L10 8L6 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="space-icon" style="color: ${color}">${icon}</span>
        <span class="space-name">${escapeHtml(spaceName)}</span>
        ${countBadge}
      </button>

      <div class="space-projects ${hasProjects ? 'space-projects-visible' : ''}">
        ${projects.map(project => renderProjectItem(project, activeProjectId)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single project item
 */
function renderProjectItem(project, activeProjectId) {
  const isActive = project.id === activeProjectId;

  return `
    <a href="/tasks.html?project=${project.id}"
       class="project-item ${isActive ? 'project-item-active' : ''}"
       data-project-id="${project.id}">
      <span class="project-icon" style="color: ${project.color || '#3b82f6'}">${project.icon || '📁'}</span>
      <span class="project-name">${escapeHtml(project.name)}</span>
    </a>
  `;
}

/**
 * Setup sidebar event listeners
 */
function setupSidebarEvents(onSpaceClick, onProjectClick) {
  const sidebar = document.getElementById('projectsSidebar');
  if (!sidebar) return;

  // Sidebar toggle (collapse/expand entire sidebar)
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-collapsed');
      // Store preference
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('sidebar-collapsed'));
    });

    // Restore collapsed state from localStorage
    const wasCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (wasCollapsed) {
      sidebar.classList.add('sidebar-collapsed');
    }
  }

  // Space header clicks (expand/collapse space) - use event delegation
  sidebar.addEventListener('click', async (e) => {
    const spaceHeader = e.target.closest('.space-header');
    if (spaceHeader) {
      e.preventDefault();
      const spaceId = spaceHeader.dataset.spaceId;
      const spaceSection = spaceHeader.parentElement;
      const projectsContainer = spaceSection.querySelector('.space-projects');

      // Toggle collapsed state
      const isCollapsed = spaceSection.classList.contains('space-collapsed');

      if (isCollapsed) {
        // Expand: Load projects if not already loaded
        if (projectsContainer.children.length === 0) {
          await loadSpaceProjects(spaceId, projectsContainer);
        }
        spaceSection.classList.remove('space-collapsed');
      } else {
        // Collapse
        spaceSection.classList.add('space-collapsed');
      }

      // Callback
      onSpaceClick(spaceId);
    }
  });

  // Project clicks - use event delegation
  sidebar.addEventListener('click', (e) => {
    const projectItem = e.target.closest('.project-item');
    if (projectItem) {
      // Remove active from all, add to clicked
      sidebar.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('project-item-active');
      });
      projectItem.classList.add('project-item-active');

      const projectId = parseInt(projectItem.dataset.projectId, 10);

      // Callback
      onProjectClick(projectId);
    }
  });

  // Create space button
  const createSpaceBtn = document.getElementById('createSpaceBtn');
  if (createSpaceBtn) {
    createSpaceBtn.addEventListener('click', () => {
      // Trigger create space modal (will be handled by parent page)
      const event = new CustomEvent('createSpace');
      document.dispatchEvent(event);
    });
  }
}

/**
 * Load projects for a space dynamically
 */
async function loadSpaceProjects(spaceId, container) {
  try {
    // Show loading state
    container.innerHTML = `
      <div class="space-loading">Loading...</div>
    `;

    const actualSpaceId = spaceId === 'unassigned' ? null : parseInt(spaceId, 10);
    const projects = await getProjectsInSpace(actualSpaceId);

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="space-empty">No projects</div>
      `;
    } else {
      container.innerHTML = projects
        .map(project => renderProjectItem(project, null))
        .join('');
    }

    container.classList.add('space-projects-visible');
  } catch (error) {
    console.error('Error loading space projects:', error);
    container.innerHTML = `
      <div class="space-error">Failed to load projects</div>
    `;
  }
}

/**
 * Escape HTML special characters
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

/**
 * Refresh sidebar (reload all data)
 * @param {Object} options - Same options as renderSidebar
 */
export async function refreshSidebar(options = {}) {
  await renderSidebar(options);
}

/**
 * Set active project in sidebar
 * @param {number} projectId - Project ID to mark as active
 */
export function setActiveProject(projectId) {
  const sidebar = document.getElementById('projectsSidebar');
  if (!sidebar) return;

  // Remove active from all
  sidebar.querySelectorAll('.project-item').forEach(item => {
    item.classList.remove('project-item-active');
  });

  // Add active to specified project
  if (projectId) {
    const projectItem = sidebar.querySelector(`.project-item[data-project-id="${projectId}"]`);
    if (projectItem) {
      projectItem.classList.add('project-item-active');
    }
  }
}
