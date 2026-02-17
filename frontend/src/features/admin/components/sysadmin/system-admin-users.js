/**
 * System Admin - User Management
 * UI, forms, and CRUD operations for user management
 */

import { Modal } from 'bootstrap';
import supabase from '@services/supabase.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml } from './system-admin-shared.js';

/**
 * Render user management tab content
 */
export function renderUsersTab(filteredUsers, allCompanies, selectedCompanyFilter) {
  return `
    <div class="system-admin-header mb-4">
      <button class="btn btn-primary" id="createUserBtn">
        ➕ Create User
      </button>
    </div>

    <div class="mb-4">
      <label class="form-label">Filter by Company:</label>
      <select class="form-control" id="companyFilter" style="max-width: 300px;">
        <option value="all">All Users (${filteredUsers.length})</option>
        <option value="personal">Personal Users</option>
        ${allCompanies.map(c => `
          <option value="${c.id}">${escapeHtml(c.name)} (${c.user_count} users)</option>
        `).join('')}
      </select>
    </div>

    ${filteredUsers.length === 0 ? `
      <div class="text-center text-muted py-4">
        <p>No users found${selectedCompanyFilter !== 'all' ? ' in this company' : ''}.</p>
      </div>
    ` : `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Company</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers.map((user, currentUserId) => renderUserRow(user, currentUserId)).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

/**
 * Render single user row
 */
function renderUserRow(user, currentUserId) {
  const fullName = user.full_name || 'N/A';
  const companyName = user.company_name || 'Personal';
  const isCurrentUser = currentUserId === user.id;

  const roleColors = {
    sys_admin: '#ef4444',
    admin: '#3b82f6',
    user: '#6b7280'
  };

  return `
    <tr data-user-id="${user.id}">
      <td>${escapeHtml(user.email)}</td>
      <td>
        ${escapeHtml(fullName)}
        ${isCurrentUser ? '<span class="badge bg-secondary ms-2">You</span>' : ''}
      </td>
      <td>${escapeHtml(companyName)}</td>
      <td>
        <span class="badge" style="background-color: ${roleColors[user.role] || roleColors.user}; color: white;">
          ${escapeHtml(user.role?.replace('_', ' ') || 'user')}
        </span>
      </td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-user" data-user-id="${user.id}" title="Edit">
          ✏️
        </button>
        ${!isCurrentUser ? `
          <button class="btn btn-sm btn-outline-warning reset-password" data-user-id="${user.id}" title="Reset Password">
            🔑
          </button>
          <button class="btn btn-sm btn-outline-danger delete-user" data-user-id="${user.id}" title="Delete">
            🗑️
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

/**
 * Show user form modal (create/edit)
 */
export function showUserForm(userId, allUsers, allCompanies, onSave) {
  const user = userId ? allUsers.find(u => u.id === userId) : null;
  const isEditing = !!user;

  const modalHtml = `
    <div class="modal fade" id="userFormModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${isEditing ? 'Edit User' : 'Create User'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${!isEditing ? `
              <div class="mb-3">
                <label class="form-label">Email *</label>
                <input type="email" class="form-control" id="userEmailInput" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Password *</label>
                <input type="password" class="form-control" id="userPasswordInput" minlength="8" required>
                <small class="text-muted">Minimum 8 characters</small>
              </div>
            ` : `
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" value="${escapeHtml(user.email)}" disabled>
              </div>
            `}

            <div class="mb-3">
              <label class="form-label">Full Name *</label>
              <input type="text" class="form-control" id="userFullNameInput" value="${escapeHtml(user?.full_name || '')}" required>
            </div>

            <div class="mb-3">
              <label class="form-label">Company</label>
              <select class="form-control" id="userCompanyInput">
                <option value="">Personal User (No Company)</option>
                ${allCompanies.map(c => `
                  <option value="${c.id}" ${user?.company_id === c.id ? 'selected' : ''}>
                    ${escapeHtml(c.name)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label">Role *</label>
              <select class="form-control" id="userRoleInput">
                <option value="user" ${user?.role === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="sys_admin" ${user?.role === 'sys_admin' ? 'selected' : ''}>System Admin</option>
              </select>
              <small class="text-muted">
                <strong>User:</strong> Can manage tasks and projects<br>
                <strong>Admin:</strong> Can manage team members and settings<br>
                <strong>System Admin:</strong> Full system access across all companies
              </small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveUserBtn">${isEditing ? 'Update' : 'Create'} User</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setupUserFormListeners(user, userId, onSave);
}

/**
 * Setup user form event listeners
 */
function setupUserFormListeners(existingUser, userId, onSave) {
  const modalElement = document.getElementById('userFormModal');
  const emailInput = document.getElementById('userEmailInput');
  const passwordInput = document.getElementById('userPasswordInput');
  const fullNameInput = document.getElementById('userFullNameInput');
  const companyInput = document.getElementById('userCompanyInput');
  const roleInput = document.getElementById('userRoleInput');
  const saveBtn = document.getElementById('saveUserBtn');

  const modal = new Modal(modalElement);
  modal.show();

  modalElement.addEventListener('hidden.bs.modal', () => {
    modalElement.remove();
  });

  saveBtn?.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();
    const fullName = fullNameInput?.value.trim();
    const companyId = companyInput?.value ? parseInt(companyInput.value) : null;
    const role = roleInput?.value;

    if (!fullName) {
      uiHelpers.showError('Full name is required');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = existingUser ? 'Updating...' : 'Creating...';

    try {
      if (!existingUser) {
        // Create new user
        if (!email || !password || password.length < 8) {
          uiHelpers.showError('Email and password (min 8 characters) are required');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Create User';
          return;
        }

        await createUser({ email, password, full_name: fullName, company_id: companyId, role });
        uiHelpers.showSuccess('User created successfully');
      } else {
        // Update existing user
        await updateUser(userId, { full_name: fullName, company_id: companyId, role });
        uiHelpers.showSuccess('User updated successfully');
      }

      modal.hide();
      if (onSave) await onSave();
    } catch (error) {
      console.error('Error saving user:', error);
      uiHelpers.showError(error.message || 'Failed to save user');
      saveBtn.disabled = false;
      saveBtn.textContent = existingUser ? 'Update User' : 'Create User';
    }
  });
}

/**
 * Show password reset modal
 */
export async function handleResetPassword(userId, allUsers) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const modalHtml = `
    <div class="modal fade" id="resetPasswordModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Reset Password</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Reset password for <strong>${escapeHtml(user.email)}</strong></p>
            <div class="mb-3">
              <label class="form-label">New Password *</label>
              <input type="password" class="form-control" id="newPasswordInput" minlength="8" required>
              <small class="text-muted">Minimum 8 characters</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="resetPasswordBtn">Reset Password</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalElement = document.getElementById('resetPasswordModal');
  const passwordInput = document.getElementById('newPasswordInput');
  const resetBtn = document.getElementById('resetPasswordBtn');

  const modal = new Modal(modalElement);
  modal.show();

  modalElement.addEventListener('hidden.bs.modal', () => {
    modalElement.remove();
  });

  resetBtn?.addEventListener('click', async () => {
    const newPassword = passwordInput.value.trim();

    if (!newPassword || newPassword.length < 8) {
      uiHelpers.showError('Password must be at least 8 characters');
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';

    try {
      await resetUserPassword(userId, newPassword);
      uiHelpers.showSuccess('Password reset successfully');
      modal.hide();
    } catch (error) {
      console.error('Error resetting password:', error);
      uiHelpers.showError(error.message || 'Failed to reset password');
      resetBtn.disabled = false;
      resetBtn.textContent = 'Reset Password';
    }
  });
}

/**
 * Handle delete user
 */
export async function handleDeleteUser(userId, allUsers, onDelete) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  if (!confirm(`Delete user ${user.email}?\n\nThis will permanently delete the user and all their data. This action cannot be undone.`)) {
    return;
  }

  try {
    await deleteUser(userId);
    uiHelpers.showSuccess('User deleted successfully');
    if (onDelete) await onDelete();
  } catch (error) {
    console.error('Error deleting user:', error);
    uiHelpers.showError(error.message || 'Failed to delete user');
  }
}

/**
 * API: Create user
 */
async function createUser({ email, password, full_name, company_id, role }) {
  // Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        role
      }
    }
  });

  if (authError) throw authError;

  // Update company_id if needed (profile is auto-created by trigger)
  if (company_id && authData.user) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ company_id })
      .eq('id', authData.user.id);

    if (updateError) throw updateError;
  }
}

/**
 * API: Update user
 */
async function updateUser(userId, { full_name, company_id, role }) {
  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      company_id: company_id || null,
      role
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  // Note: Updating auth.users metadata (full_name) requires admin API
  // This could be added via Edge Function if needed
}

/**
 * API: Reset user password
 */
async function resetUserPassword(userId, newPassword) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(
    `${supabase.supabaseUrl}/functions/v1/admin-reset-password`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, newPassword }),
    }
  );

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to reset password');
}

/**
 * API: Delete user
 */
async function deleteUser(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(
    `${supabase.supabaseUrl}/functions/v1/admin-delete-user`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    }
  );

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to delete user');
}
