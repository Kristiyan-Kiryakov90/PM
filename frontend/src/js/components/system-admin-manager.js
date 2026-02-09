/**
 * System Admin Manager - Sys Admin Only
 * Full CRUD operations on all users and companies across the system
 */

import { Modal } from 'bootstrap';
import supabase from '../services/supabase.js';
import { showError, showSuccess } from '../utils/ui-helpers.js';

/**
 * Render system admin manager in a container
 * @param {HTMLElement} container - Container element
 */
export async function renderSystemAdminManager(container) {
  if (!container) return;

  let allUsers = [];
  let allCompanies = [];
  let editingUserId = null;
  let editingCompanyId = null;
  let currentUserId = null;
  let selectedCompanyFilter = 'all';
  let activeSubTab = 'users'; // 'users' or 'companies'

  // Check if current user is sys_admin
  async function checkSysAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    currentUserId = user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'sys_admin') {
      showError('Access denied. System admin privileges required.');
      return false;
    }

    return true;
  }

  async function render() {
    try {
      const isSysAdmin = await checkSysAdmin();
      if (!isSysAdmin) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. System admin privileges required.</div>';
        return;
      }

      // Fetch all users and companies
      [allUsers, allCompanies] = await Promise.all([
        getAllUsersWithCompanies(),
        getAllCompanies()
      ]);

      // Apply company filter
      let filteredUsers = allUsers;
      if (selectedCompanyFilter !== 'all') {
        if (selectedCompanyFilter === 'personal') {
          filteredUsers = allUsers.filter(u => !u.company_id);
        } else {
          filteredUsers = allUsers.filter(u => u.company_id === parseInt(selectedCompanyFilter));
        }
      }

      container.innerHTML = `
        <div class="system-admin-manager">
          <!-- Sub-tabs -->
          <div class="system-admin-subtabs mb-4">
            <button class="system-admin-subtab ${activeSubTab === 'users' ? 'active' : ''}" data-subtab="users">
              👤 Users (${allUsers.length})
            </button>
            <button class="system-admin-subtab ${activeSubTab === 'companies' ? 'active' : ''}" data-subtab="companies">
              🏢 Companies (${allCompanies.length})
            </button>
          </div>

          <!-- Users Tab -->
          <div class="system-admin-content ${activeSubTab === 'users' ? 'active' : ''}">
            <div class="system-admin-header mb-4">
              <button class="btn btn-primary" id="createUserBtn">
                ➕ Create User
              </button>
            </div>

            <div class="mb-4">
              <label class="form-label">Filter by Company:</label>
              <select class="form-control" id="companyFilter" style="max-width: 300px;">
                <option value="all">All Users (${allUsers.length})</option>
                <option value="personal">Personal Users (${allUsers.filter(u => !u.company_id).length})</option>
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
                    ${filteredUsers.map(user => renderUserRow(user)).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Companies Tab -->
          <div class="system-admin-content ${activeSubTab === 'companies' ? 'active' : ''}">
            <div class="system-admin-header mb-4">
              <button class="btn btn-primary" id="createCompanyBtn">
                ➕ Create Company
              </button>
            </div>

            ${allCompanies.length === 0 ? `
              <div class="text-center text-muted py-4">
                <p>No companies yet.</p>
              </div>
            ` : `
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead>
                    <tr>
                      <th>Company Name</th>
                      <th>Users</th>
                      <th>Projects</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allCompanies.map(company => renderCompanyRow(company)).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;

      setupEventListeners();
    } catch (error) {
      console.error('Error loading system admin manager:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <p>Failed to load system admin manager. ${error.message}</p>
          <button class="btn btn-sm btn-primary mt-2" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function renderUserRow(user) {
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

  function renderCompanyRow(company) {
    return `
      <tr data-company-id="${company.id}">
        <td>${escapeHtml(company.name)}</td>
        <td>${company.user_count || 0}</td>
        <td>${company.project_count || 0}</td>
        <td>${new Date(company.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-company" data-company-id="${company.id}" title="Edit">
            ✏️
          </button>
          <button class="btn btn-sm btn-outline-danger delete-company" data-company-id="${company.id}" title="Delete">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }

  function setupEventListeners() {
    // Sub-tab switching
    container.querySelectorAll('.system-admin-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubTab = btn.dataset.subtab;
        render();
      });
    });

    // Company filter
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
      companyFilter.value = selectedCompanyFilter;
      companyFilter.addEventListener('change', (e) => {
        selectedCompanyFilter = e.target.value;
        render();
      });
    }

    // Event delegation for all buttons
    container.addEventListener('click', async (e) => {
      // Create user
      if (e.target.closest('#createUserBtn')) {
        e.preventDefault();
        showUserForm();
        return;
      }

      // Edit user
      const editUserBtn = e.target.closest('.edit-user');
      if (editUserBtn) {
        e.preventDefault();
        const userId = editUserBtn.dataset.userId;
        showUserForm(userId);
        return;
      }

      // Reset password
      const resetPasswordBtn = e.target.closest('.reset-password');
      if (resetPasswordBtn) {
        e.preventDefault();
        const userId = resetPasswordBtn.dataset.userId;
        await handleResetPassword(userId);
        return;
      }

      // Delete user
      const deleteUserBtn = e.target.closest('.delete-user');
      if (deleteUserBtn) {
        e.preventDefault();
        const userId = deleteUserBtn.dataset.userId;
        await handleDeleteUser(userId);
        return;
      }

      // Create company
      if (e.target.closest('#createCompanyBtn')) {
        e.preventDefault();
        showCompanyForm();
        return;
      }

      // Edit company
      const editCompanyBtn = e.target.closest('.edit-company');
      if (editCompanyBtn) {
        e.preventDefault();
        const companyId = editCompanyBtn.dataset.companyId;
        showCompanyForm(companyId);
        return;
      }

      // Delete company
      const deleteCompanyBtn = e.target.closest('.delete-company');
      if (deleteCompanyBtn) {
        e.preventDefault();
        const companyId = deleteCompanyBtn.dataset.companyId;
        await handleDeleteCompany(companyId);
        return;
      }
    });
  }

  function showUserForm(userId = null) {
    const user = userId ? allUsers.find(u => u.id === userId) : null;
    editingUserId = userId;

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
    setupUserFormListeners(user);
  }

  function setupUserFormListeners(existingUser) {
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
        showError('Full name is required');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = existingUser ? 'Updating...' : 'Creating...';

      try {
        if (!existingUser) {
          // Create new user
          if (!email || !password || password.length < 8) {
            showError('Email and password (min 8 characters) are required');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create User';
            return;
          }

          await createUser({ email, password, full_name: fullName, company_id: companyId, role });
          showSuccess('User created successfully');
        } else {
          // Update existing user
          await updateUser(editingUserId, { full_name: fullName, company_id: companyId, role });
          showSuccess('User updated successfully');
        }

        modal.hide();
        await render();
      } catch (error) {
        console.error('Error saving user:', error);
        showError(error.message || 'Failed to save user');
        saveBtn.disabled = false;
        saveBtn.textContent = existingUser ? 'Update User' : 'Create User';
      }
    });
  }

  async function handleResetPassword(userId) {
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
        showError('Password must be at least 8 characters');
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = 'Resetting...';

      try {
        await resetUserPassword(userId, newPassword);
        showSuccess('Password reset successfully');
        modal.hide();
      } catch (error) {
        console.error('Error resetting password:', error);
        showError(error.message || 'Failed to reset password');
        resetBtn.disabled = false;
        resetBtn.textContent = 'Reset Password';
      }
    });
  }

  async function handleDeleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Delete user ${user.email}?\n\nThis will permanently delete the user and all their data. This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
      showSuccess('User deleted successfully');
      await render();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError(error.message || 'Failed to delete user');
    }
  }

  function showCompanyForm(companyId = null) {
    const company = companyId ? allCompanies.find(c => c.id === parseInt(companyId)) : null;
    editingCompanyId = companyId;

    const isEditing = !!company;

    const modalHtml = `
      <div class="modal fade" id="companyFormModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${isEditing ? 'Edit Company' : 'Create Company'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" id="companyNameInput" value="${escapeHtml(company?.name || '')}" required>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveCompanyBtn">${isEditing ? 'Update' : 'Create'} Company</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setupCompanyFormListeners(company);
  }

  function setupCompanyFormListeners(existingCompany) {
    const modalElement = document.getElementById('companyFormModal');
    const nameInput = document.getElementById('companyNameInput');
    const saveBtn = document.getElementById('saveCompanyBtn');

    const modal = new Modal(modalElement);
    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    });

    saveBtn?.addEventListener('click', async () => {
      const name = nameInput?.value.trim();

      if (!name) {
        showError('Company name is required');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = existingCompany ? 'Updating...' : 'Creating...';

      try {
        if (!existingCompany) {
          await createCompany({ name });
          showSuccess('Company created successfully');
        } else {
          await updateCompany(editingCompanyId, { name });
          showSuccess('Company updated successfully');
        }

        modal.hide();
        await render();
      } catch (error) {
        console.error('Error saving company:', error);
        showError(error.message || 'Failed to save company');
        saveBtn.disabled = false;
        saveBtn.textContent = existingCompany ? 'Update Company' : 'Create Company';
      }
    });
  }

  async function handleDeleteCompany(companyId) {
    const company = allCompanies.find(c => c.id === parseInt(companyId));
    if (!company) return;

    if (!confirm(`Delete company "${company.name}"?\n\nWarning: This will affect ${company.user_count || 0} users and ${company.project_count || 0} projects.\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteCompany(companyId);
      showSuccess('Company deleted successfully');
      await render();
    } catch (error) {
      console.error('Error deleting company:', error);
      showError(error.message || 'Failed to delete company');
    }
  }

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

  // Initial render
  await render();

  return { render };
}

/**
 * API Functions
 */

async function getAllUsersWithCompanies() {
  const { data, error } = await supabase.rpc('get_all_users_with_companies');
  if (error) throw error;
  return data || [];
}

async function getAllCompanies() {
  const { data, error } = await supabase.rpc('get_all_companies');
  if (error) throw error;
  return data || [];
}

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
  // For now, we'll skip updating the full_name in auth.users
  // This could be added via Edge Function if needed
}

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

async function createCompany({ name }) {
  const { error } = await supabase
    .from('companies')
    .insert({ name });

  if (error) throw error;
}

async function updateCompany(companyId, { name }) {
  const { error } = await supabase
    .from('companies')
    .update({ name })
    .eq('id', companyId);

  if (error) throw error;
}

async function deleteCompany(companyId) {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', companyId);

  if (error) throw error;
}
