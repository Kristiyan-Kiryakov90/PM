/**
 * Team Manager - UI Rendering & Templates
 * Handles HTML generation and rendering for team member list
 */

/**
 * Render team member list item HTML
 * @param {Object} member - Member object
 * @param {string} currentUserId - Current user's ID
 * @param {boolean} isSysAdmin - Whether current user is sys_admin
 * @returns {string} HTML string
 */
export function renderMemberListItem(member, currentUserId, isSysAdmin) {
  const fullName = member.full_name || member.email;
  const role = member.role || 'user';
  const companyName = member.company_name || 'Personal';
  const isCurrentUser = currentUserId === member.id;

  // Cannot delete yourself, and regular admins cannot delete sys_admins
  const cannotDelete = isCurrentUser || (!isSysAdmin && role === 'sys_admin');

  const roleColors = {
    sys_admin: '#ef4444',
    admin: '#3b82f6',
    user: '#6b7280'
  };

  return `
    <div class="team-manager-item" data-member-id="${member.id}">
      <div class="team-manager-avatar" style="background-color: ${getAvatarColor(member.email)}">
        ${fullName.charAt(0).toUpperCase()}
      </div>
      <div class="team-manager-info">
        <div class="team-manager-name">
          ${escapeHtml(fullName)}
          ${isCurrentUser ? ' <span style="font-size: 0.75rem; color: #6b7280;">(You)</span>' : ''}
        </div>
        <div class="team-manager-email">${escapeHtml(member.email)}</div>
        ${isSysAdmin ? `<div class="team-manager-company">🏢 ${escapeHtml(companyName)}</div>` : ''}
      </div>
      <div class="team-manager-role">
        <span class="badge" style="background-color: ${roleColors[role]}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem;">
          ${role.replace('_', ' ')}
        </span>
      </div>
      <div class="team-manager-actions">
        <button class="team-manager-action-btn edit" data-member-id="${member.id}" title="Edit">
          ✏️
        </button>
        ${isSysAdmin && !isCurrentUser ? `
          <button class="team-manager-action-btn reset-password" data-member-id="${member.id}" title="Reset Password">
            🔑
          </button>
        ` : ''}
        <button
          class="team-manager-action-btn delete"
          data-member-id="${member.id}"
          title="${cannotDelete ? (isCurrentUser ? 'Cannot delete yourself' : 'Cannot delete system admin') : 'Delete'}"
          ${cannotDelete ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}
        >
          🗑️
        </button>
      </div>
    </div>
  `;
}

/**
 * Render main team manager HTML
 * @param {Object} params - Render parameters
 * @returns {string} HTML string
 */
export function renderTeamManagerHTML({
  isSysAdmin,
  teamMembers,
  allMembers,
  companies,
  selectedCompanyFilter,
  currentUserId
}) {
  return `
    <div class="team-manager-admin">
      <div class="team-manager-header mb-4">
        <div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 600;">
            ${isSysAdmin ? 'All Users' : 'Team Members'}
          </h3>
          <p style="margin: 0; color: var(--gray-600); font-size: 0.875rem;">
            ${isSysAdmin ? 'Manage users across all companies' : 'Manage users in your company'}
          </p>
        </div>
        <button class="btn btn-primary" id="addMemberBtn">
          ➕ Add Member
        </button>
      </div>

      ${isSysAdmin ? renderCompanyFilter(allMembers, companies, selectedCompanyFilter) : ''}

      ${teamMembers.length === 0 ? renderEmptyState(selectedCompanyFilter) : renderMemberList(teamMembers, currentUserId, isSysAdmin)}
    </div>
  `;
}

/**
 * Render company filter dropdown (sys_admin only)
 * @param {Array} allMembers - All members
 * @param {Array} companies - All companies
 * @param {string} selectedFilter - Selected filter value
 * @returns {string} HTML string
 */
function renderCompanyFilter(allMembers, companies, selectedFilter) {
  return `
    <div class="mb-4">
      <label class="form-label">Filter by Company:</label>
      <select class="form-control" id="companyFilter" style="max-width: 300px;">
        <option value="all">All Users (${allMembers.length})</option>
        <option value="personal">Personal Users (${allMembers.filter(m => !m.company_id).length})</option>
        ${companies.map(c => `
          <option value="${c.id}">${escapeHtml(c.name)} (${c.user_count} users)</option>
        `).join('')}
      </select>
    </div>
  `;
}

/**
 * Render empty state
 * @param {string} selectedFilter - Selected filter value
 * @returns {string} HTML string
 */
function renderEmptyState(selectedFilter) {
  return `
    <div class="team-manager-empty">
      <div class="team-manager-empty-icon">👥</div>
      <p class="team-manager-empty-text">No team members ${selectedFilter !== 'all' ? 'in this company' : 'yet'}.</p>
    </div>
  `;
}

/**
 * Render member list
 * @param {Array} teamMembers - Team members to render
 * @param {string} currentUserId - Current user's ID
 * @param {boolean} isSysAdmin - Whether current user is sys_admin
 * @returns {string} HTML string
 */
function renderMemberList(teamMembers, currentUserId, isSysAdmin) {
  return `
    <div class="team-manager-list">
      ${teamMembers.map(member => renderMemberListItem(member, currentUserId, isSysAdmin)).join('')}
    </div>
  `;
}

/**
 * Render error state
 * @param {Error} error - Error object
 * @returns {string} HTML string
 */
export function renderErrorState(error) {
  return `
    <div class="alert alert-danger">
      <p>Failed to load team members. ${error.message}</p>
      <button class="btn btn-sm btn-primary mt-2" onclick="location.reload()">Retry</button>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
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
 * Get avatar color based on email
 * @param {string} email - User email
 * @returns {string} Color hex code
 */
export function getAvatarColor(email) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
