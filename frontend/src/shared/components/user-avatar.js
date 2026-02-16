import { teamService } from '../services/team-service.js';

/**
 * User Avatar Component
 * Displays user avatar with status indicator
 */

/**
 * Render user avatar
 * @param {Object} user - User object
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderUserAvatar(user, options = {}) {
    const {
        size = 'md',
        showStatus = true,
        showTooltip = true,
        className = ''
    } = options;

    const sizeClasses = {
        xs: 'avatar-xs',
        sm: 'avatar-sm',
        md: 'avatar-md',
        lg: 'avatar-lg',
        xl: 'avatar-xl'
    };

    const sizeClass = sizeClasses[size] || sizeClasses.md;
    const initials = teamService.getInitials(user.full_name || user.email);
    const statusColor = teamService.getStatusColor(user.status);
    const tooltipText = showTooltip ? `${user.full_name || user.email}${user.status ? ' - ' + user.status : ''}` : '';

    return `
        <div class="user-avatar ${sizeClass} ${className}" ${showTooltip ? `title="${tooltipText}"` : ''}>
            ${user.avatar_url
                ? `<img src="${user.avatar_url}" alt="${user.full_name || user.email}" class="avatar-image" />`
                : `<div class="avatar-initials">${initials}</div>`
            }
            ${showStatus && user.status
                ? `<span class="avatar-status bg-${statusColor}"></span>`
                : ''
            }
        </div>
    `;
}

/**
 * Render user list item
 * @param {Object} user - User object
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderUserListItem(user, options = {}) {
    const {
        showRole = true,
        showStatus = true,
        showEmail = true
    } = options;

    const statusColor = teamService.getStatusColor(user.status);
    const lastSeen = teamService.formatLastSeen(user.last_seen);

    return `
        <div class="user-list-item" data-user-id="${user.user_id}">
            ${renderUserAvatar(user, { size: 'md', showStatus })}
            <div class="user-info">
                <div class="user-name">${user.full_name || user.email}</div>
                ${showEmail && user.full_name ? `<div class="user-email text-muted small">${user.email}</div>` : ''}
                <div class="user-meta">
                    ${showRole ? `<span class="badge bg-secondary">${user.role}</span>` : ''}
                    ${showStatus ? `<span class="text-${statusColor} small ms-2">${user.status || 'offline'}</span>` : ''}
                    ${user.status === 'offline' && user.last_seen ? `<span class="text-muted small ms-2">Last seen ${lastSeen}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render user selector (for assigning tasks, etc.)
 * @param {Array} users - List of users
 * @param {Object} options - Rendering options
 * @returns {string} HTML string
 */
export function renderUserSelector(users, options = {}) {
    const {
        selectedUserId = null,
        name = 'user_id',
        placeholder = 'Select a user...',
        allowUnassigned = true
    } = options;

    const userOptions = users.map(user => {
        const initials = teamService.getInitials(user.full_name || user.email);
        const selected = user.user_id === selectedUserId ? 'selected' : '';

        return `
            <option value="${user.user_id}" ${selected} data-initials="${initials}">
                ${user.full_name || user.email} (${user.role})
            </option>
        `;
    }).join('');

    return `
        <select class="form-select user-selector" name="${name}">
            ${allowUnassigned ? `<option value="">${placeholder}</option>` : ''}
            ${userOptions}
        </select>
    `;
}
