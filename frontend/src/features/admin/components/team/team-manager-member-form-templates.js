/**
 * Team Manager - Member Form HTML Templates
 * Reusable HTML rendering functions for the member form modal
 */

import { escapeHtml } from './team-manager-ui.js';

/**
 * Render email field for new member
 */
export function renderEmailField() {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Email Address *</label>
      <input
        type="email"
        class="form-control"
        id="memberEmailInput"
        placeholder="user@example.com"
        required
      />
      <small class="form-text text-muted">User will receive an invitation email</small>
    </div>
  `;
}

/**
 * Render disabled email field for existing member
 */
export function renderEmailFieldDisabled(email) {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Email Address</label>
      <input
        type="email"
        class="form-control"
        value="${escapeHtml(email)}"
        disabled
      />
    </div>
  `;
}

/**
 * Render disabled company field
 */
export function renderCompanyFieldDisabled(companyName) {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Company</label>
      <input
        type="text"
        class="form-control"
        value="${escapeHtml(companyName || 'Personal User')}"
        disabled
      />
      <small class="form-text text-muted">User's company affiliation (cannot be changed)</small>
    </div>
  `;
}

/**
 * Render name fields
 */
export function renderNameFields(firstName, lastName) {
  return `
    <div class="row">
      <div class="col-md-6">
        <div class="form-group mb-3">
          <label class="form-label">First Name *</label>
          <input
            type="text"
            class="form-control"
            id="memberFirstNameInput"
            value="${escapeHtml(firstName)}"
            placeholder="John"
            required
          />
        </div>
      </div>
      <div class="col-md-6">
        <div class="form-group mb-3">
          <label class="form-label">Last Name *</label>
          <input
            type="text"
            class="form-control"
            id="memberLastNameInput"
            value="${escapeHtml(lastName)}"
            placeholder="Doe"
            required
          />
        </div>
      </div>
    </div>
  `;
}

/**
 * Render password field for new member
 */
export function renderPasswordField() {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Password *</label>
      <input
        type="password"
        class="form-control"
        id="memberPasswordInput"
        placeholder="Min. 8 characters"
        minlength="8"
        required
      />
      <small class="form-text text-muted">Minimum 8 characters</small>
    </div>
  `;
}

/**
 * Render password field with reset button for existing member
 */
export function renderPasswordFieldWithReset(isSysAdmin) {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Password</label>
      <div class="d-flex align-items-center gap-2">
        <input
          type="password"
          class="form-control"
          value="••••••••••••"
          disabled
        />
        ${isSysAdmin ? `
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            id="resetPasswordInlineBtn"
            style="white-space: nowrap;"
          >
            🔑 Reset
          </button>
        ` : `
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            id="sendPasswordResetEmailBtn"
            style="white-space: nowrap;"
          >
            📧 Send Reset Email
          </button>
        `}
      </div>
      <small class="form-text text-muted">
        ${isSysAdmin
          ? 'Click "🔑 Reset" to set a new password for this user'
          : 'Send a password reset link to the user\'s email address'}
      </small>
    </div>
  `;
}

/**
 * Render company field for new member (regular admin)
 */
export function renderCompanyField(currentUserCompany) {
  return `
    <div class="form-group mb-3">
      <label class="form-label">Company ${!currentUserCompany ? '*' : ''}</label>
      <input
        type="text"
        class="form-control"
        id="memberCompanyInput"
        value="${currentUserCompany ? escapeHtml(currentUserCompany.name) : ''}"
        placeholder="${currentUserCompany ? '' : 'Enter company name'}"
        ${currentUserCompany ? 'disabled' : 'required'}
      />
      <small class="form-text text-muted">
        ${currentUserCompany
          ? 'New user will be added to your company'
          : 'Create a company for this user. You will also be assigned to this company.'}
      </small>
    </div>
  `;
}

/**
 * Render role field
 */
export function renderRoleField(member, role, isEditingSelf, isSysAdmin) {
  if (member && role === 'sys_admin') {
    return `
      <div class="form-group mb-3">
        <label class="form-label">Role *</label>
        <input type="hidden" id="memberRoleInput" value="sys_admin" />
        <select class="form-control" disabled>
          <option selected>System Admin</option>
        </select>
        <small class="form-text text-muted">
          <strong>⚠️ System Administrator:</strong> This user has full system access. The sys_admin role cannot be changed or reassigned by regular admins.
        </small>
      </div>
    `;
  }

  if (isEditingSelf && role === 'admin') {
    return `
      <div class="form-group mb-3">
        <label class="form-label">Role *</label>
        <input type="hidden" id="memberRoleInput" value="admin" />
        <select class="form-control" disabled>
          <option value="admin" selected>Company Admin</option>
        </select>
        <small class="form-text text-muted">
          <strong>⚠️ Cannot change your own role:</strong> You cannot downgrade yourself from admin. Ask another admin to change your role if needed.
        </small>
      </div>
    `;
  }

  return `
    <div class="form-group mb-3">
      <label class="form-label">Role *</label>
      <select class="form-control" id="memberRoleInput">
        <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Company Admin</option>
        ${isSysAdmin ? `<option value="sys_admin" ${role === 'sys_admin' ? 'selected' : ''}>System Admin</option>` : ''}
      </select>
      <small class="form-text text-muted">
        <strong>User:</strong> Can manage tasks and projects<br>
        <strong>Company Admin:</strong> Can manage team members and company settings
        ${isSysAdmin ? '<br><strong>System Admin:</strong> Full system access across all companies' : ''}
      </small>
    </div>
  `;
}
