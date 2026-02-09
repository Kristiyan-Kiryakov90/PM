/**
 * Team Member Manager - Admin Only
 * Create, edit, view, and manage team members (admin interface)
 * Enhanced with sys_admin capabilities
 */

import { Modal } from 'bootstrap';
import supabase from '../services/supabase.js';
import { teamService } from '../services/team-service.js';
import { showError, showSuccess } from '../utils/ui-helpers.js';

/**
 * Render team member manager in a container
 * @param {HTMLElement} container - Container element
 */
export async function renderTeamMemberManager(container) {
  if (!container) return;

  let teamMembers = [];
  let allMembers = []; // For filtering
  let companies = [];
  let editingMemberId = null;
  let isSysAdmin = false;
  let currentUserId = null;
  let selectedCompanyFilter = 'all';
  let currentUserCompany = null;

  // Check if current user is sys_admin and get company info
  async function checkSysAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    currentUserId = user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    isSysAdmin = profile?.role === 'sys_admin';

    // Store current user's company info for regular admins
    if (!isSysAdmin && profile?.company_id) {
      // Get company name
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single();

      currentUserCompany = {
        id: profile.company_id,
        name: company?.name || 'Your Company'
      };

      console.log('Current user company:', currentUserCompany);
    }

    return isSysAdmin;
  }

  async function render() {
    try {
      console.log('Fetching team members...');
      await checkSysAdmin();

      if (isSysAdmin) {
        // Fetch all users and companies for sys_admin
        [allMembers, companies] = await Promise.all([
          getAllUsersWithCompanies(),
          getAllCompanies()
        ]);
        teamMembers = allMembers;

        // Apply company filter for sys_admin
        if (selectedCompanyFilter !== 'all') {
          if (selectedCompanyFilter === 'personal') {
            teamMembers = allMembers.filter(m => !m.company_id);
          } else {
            teamMembers = allMembers.filter(m => m.company_id === parseInt(selectedCompanyFilter));
          }
        }
      } else {
        // Regular admin - fetch only company members
        teamMembers = await getTeamMembers();
        allMembers = teamMembers;
      }

      console.log('Team members fetched:', teamMembers.length, 'members');

      container.innerHTML = `
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

          ${isSysAdmin ? `
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
          ` : ''}

          ${teamMembers.length === 0 ? `
            <div class="team-manager-empty">
              <div class="team-manager-empty-icon">👥</div>
              <p class="team-manager-empty-text">No team members ${selectedCompanyFilter !== 'all' ? 'in this company' : 'yet'}.</p>
            </div>
          ` : `
            <div class="team-manager-list">
              ${teamMembers.map(member => renderMemberListItem(member)).join('')}
            </div>
          `}
        </div>
      `;

      setupEventListeners();
    } catch (error) {
      console.error('Error loading team members:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <p>Failed to load team members. ${error.message}</p>
          <button class="btn btn-sm btn-primary mt-2" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  function renderMemberListItem(member) {
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

  function setupEventListeners() {
    console.log('Setting up event listeners for team manager');

    // Company filter (sys_admin only)
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
      companyFilter.value = selectedCompanyFilter;
      companyFilter.addEventListener('change', (e) => {
        selectedCompanyFilter = e.target.value;
        render();
      });
    }

    // Add member button
    container.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('#addMemberBtn');
      if (addBtn) {
        e.preventDefault();
        console.log('Add member button clicked');
        showMemberForm();
        return;
      }

      // Edit button
      const editBtn = e.target.closest('.edit');
      if (editBtn) {
        e.preventDefault();
        const memberId = editBtn.dataset.memberId;
        console.log('Edit button clicked for member:', memberId);
        showMemberForm(memberId);
        return;
      }

      // Reset password button (sys_admin only)
      const resetPasswordBtn = e.target.closest('.reset-password');
      if (resetPasswordBtn) {
        e.preventDefault();
        const memberId = resetPasswordBtn.dataset.memberId;
        console.log('Reset password button clicked for member:', memberId);
        await handleResetPassword(memberId);
        return;
      }

      // Delete button
      const deleteBtn = e.target.closest('.delete');
      if (deleteBtn) {
        e.preventDefault();
        const memberId = deleteBtn.dataset.memberId;
        console.log('Delete button clicked for member:', memberId);
        await handleDeleteMember(memberId);
        return;
      }
    });
  }

  function showMemberForm(memberId = null) {
    const member = memberId ? allMembers.find(m => m.id === memberId) : null;
    editingMemberId = memberId;

    const fullName = member?.full_name || '';
    const role = member?.role || 'user';

    // Parse first and last name if editing
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const formHtml = `
      <div class="modal fade" id="memberFormModal" tabindex="-1" aria-labelledby="memberFormModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="memberFormModalTitle">${member ? 'Edit Team Member' : 'Add Team Member'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="member-form">
                ${!member ? `
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
                ` : `
                  <div class="form-group mb-3">
                    <label class="form-label">Email Address</label>
                    <input
                      type="email"
                      class="form-control"
                      value="${escapeHtml(member.email)}"
                      disabled
                    />
                  </div>
                `}

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

                ${!member ? `
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
                ` : isSysAdmin ? `
                  <div class="alert alert-info mb-3" style="font-size: 0.875rem;">
                    <strong>Password Reset:</strong> Use the "🔑 Reset Password" button on the user card to change their password.
                  </div>
                ` : `
                  <div class="alert alert-info mb-3" style="font-size: 0.875rem;">
                    <strong>Password Reset:</strong> Users can reset their own password using the "Forgot Password" link on the sign-in page.
                  </div>
                `}

                ${!isSysAdmin && !member ? `
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
                ` : ''}

                <div class="form-group mb-3">
                  <label class="form-label">Role *</label>
                  ${member && role === 'sys_admin' ? `
                    <input type="hidden" id="memberRoleInput" value="sys_admin" />
                    <select class="form-control" disabled>
                      <option selected>System Admin</option>
                    </select>
                  ` : `
                    <select class="form-control" id="memberRoleInput">
                      <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
                      <option value="admin" ${role === 'admin' ? 'selected' : ''}>Company Admin</option>
                      ${isSysAdmin ? `<option value="sys_admin" ${role === 'sys_admin' ? 'selected' : ''}>System Admin</option>` : ''}
                    </select>
                  `}
                  <small class="form-text text-muted">
                    ${member && role === 'sys_admin' ? `
                      <strong>⚠️ System Administrator:</strong> This user has full system access. The sys_admin role cannot be changed or reassigned by regular admins.
                    ` : `
                      <strong>User:</strong> Can manage tasks and projects<br>
                      <strong>Company Admin:</strong> Can manage team members and company settings
                      ${isSysAdmin ? '<br><strong>System Admin:</strong> Full system access across all companies' : ''}
                    `}
                  </small>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="saveMemberBtn">${member ? 'Update' : 'Add'} Member</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', formHtml);
    setupFormListeners(member);
  }

  function setupFormListeners(existingMember) {
    const modalElement = document.getElementById('memberFormModal');
    const emailInput = document.getElementById('memberEmailInput');
    const firstNameInput = document.getElementById('memberFirstNameInput');
    const lastNameInput = document.getElementById('memberLastNameInput');
    const passwordInput = document.getElementById('memberPasswordInput');
    const roleInput = document.getElementById('memberRoleInput');
    const saveBtn = document.getElementById('saveMemberBtn');

    // Create and show Bootstrap modal
    const modal = new Modal(modalElement);
    modal.show();

    // Clean up modal element when hidden
    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    });

    // Focus first input when modal is shown
    modalElement.addEventListener('shown.bs.modal', () => {
      (emailInput || firstNameInput)?.focus();
    });

    // Save button
    saveBtn?.addEventListener('click', async () => {
      console.log('Save button clicked');

      const email = emailInput?.value.trim();
      const firstName = firstNameInput?.value.trim();
      const lastName = lastNameInput?.value.trim();
      const companyName = document.getElementById('memberCompanyInput')?.value.trim();
      const role = roleInput?.value;

      console.log('Form values:', { firstName, lastName, companyName, role });

      if (!firstName) {
        showError('First name is required');
        return;
      }

      if (!lastName) {
        showError('Last name is required');
        return;
      }

      // For regular admins without a company, company name is required ONLY when creating new users
      if (!isSysAdmin && !existingMember && !currentUserCompany && !companyName) {
        showError('Company name is required');
        return;
      }

      const fullName = `${firstName} ${lastName}`;

      // Disable button during save
      saveBtn.disabled = true;
      saveBtn.textContent = existingMember ? 'Updating...' : 'Adding...';

      if (!existingMember) {
        // Creating new user - validate email and password
        const password = passwordInput?.value?.trim() || '';

        if (!email) {
          showError('Email is required');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add Member';
          return;
        }

        if (!password || password.length < 8) {
          showError('Password must be at least 8 characters');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add Member';
          return;
        }

        try {
          console.log('Creating member:', { email, full_name: fullName, company_name: companyName, role });
          await createMember({ email, full_name: fullName, password, role, company_name: companyName });
          showSuccess('Team member added');
          modal.hide();
          await render();
        } catch (error) {
          console.error('Error saving member:', error);
          showError(error.message || 'Failed to add team member');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Add Member';
        }
      } else {
        // Editing existing user
        try {
          // Don't allow changing sys_admin role
          const memberToUpdate = allMembers.find(m => m.id === editingMemberId);
          const finalRole = memberToUpdate?.role === 'sys_admin' ? 'sys_admin' : role;

          console.log('Updating member:', editingMemberId, { full_name: fullName, role: finalRole });
          await updateMember(editingMemberId, { full_name: fullName, role: finalRole });
          showSuccess('Team member updated');
          modal.hide();
          await render();
        } catch (error) {
          console.error('Error saving member:', error);
          showError(error.message || 'Failed to update team member');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Update Member';
        }
      }
    });
  }

  async function handleResetPassword(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    const fullName = member.full_name || member.email;

    // Show password reset modal
    showPasswordResetModal(memberId, fullName);
  }

  function showPasswordResetModal(memberId, fullName) {
    const modalHtml = `
      <div class="modal fade" id="passwordResetModal" tabindex="-1" aria-labelledby="passwordResetModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="passwordResetModalTitle">Reset Password</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-4">Reset password for <strong>${escapeHtml(fullName)}</strong></p>
              <div class="form-group mb-3">
                <label class="form-label">New Password *</label>
                <div style="position: relative;">
                  <input
                    type="password"
                    class="form-control"
                    id="newPasswordInput"
                    placeholder="Enter new password (min. 8 characters)"
                    minlength="8"
                    required
                    style="padding-right: 40px;"
                  />
                  <button
                    type="button"
                    class="btn btn-sm"
                    id="togglePasswordBtn"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; background: none; padding: 4px 8px; font-size: 1.2rem;"
                    title="Show/Hide Password"
                  >
                    👁️
                  </button>
                </div>
                <small class="form-text text-muted">Minimum 8 characters</small>
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
    setupPasswordResetListeners(memberId, fullName);
  }

  function setupPasswordResetListeners(memberId, fullName) {
    const modalElement = document.getElementById('passwordResetModal');
    const passwordInput = document.getElementById('newPasswordInput');
    const toggleBtn = document.getElementById('togglePasswordBtn');
    const resetBtn = document.getElementById('resetPasswordBtn');

    // Create and show Bootstrap modal
    const modal = new Modal(modalElement);
    modal.show();

    // Clean up modal element when hidden
    modalElement.addEventListener('hidden.bs.modal', () => {
      modalElement.remove();
    });

    // Focus password input when modal is shown
    modalElement.addEventListener('shown.bs.modal', () => {
      passwordInput?.focus();
    });

    // Toggle password visibility
    toggleBtn?.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });

    // Reset password button
    resetBtn?.addEventListener('click', async () => {
      const newPassword = passwordInput.value.trim();

      if (!newPassword || newPassword.length < 8) {
        showError('Password must be at least 8 characters');
        return;
      }

      resetBtn.disabled = true;
      resetBtn.textContent = 'Resetting...';

      try {
        await resetUserPassword(memberId, newPassword);
        showSuccess(`Password reset successfully for ${fullName}`);
        modal.hide();
      } catch (error) {
        console.error('Error resetting password:', error);
        showError(error.message || 'Failed to reset password');
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Reset Password';
      }
    });

    // Allow Enter key to submit
    passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        resetBtn?.click();
      }
    });
  }

  async function handleDeleteMember(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    const fullName = member.full_name || member.email;

    // Prevent regular admins from deleting sys_admins
    if (!isSysAdmin && member.role === 'sys_admin') {
      showError('Cannot delete system administrator. Contact a system admin.');
      return;
    }

    // Prevent deleting yourself
    if (member.id === currentUserId) {
      showError('Cannot delete yourself.');
      return;
    }

    if (!confirm(`Remove ${fullName} from ${isSysAdmin ? 'the system' : 'your company'}? They will lose access to all projects and tasks.\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMember(memberId);
      showSuccess('Team member removed');
      await render();
    } catch (error) {
      console.error('Error deleting member:', error);
      showError(error.message || 'Failed to remove team member');
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

  function getAvatarColor(email) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  // Initial render
  await render();

  return {
    render,
  };
}

/**
 * Get all users with companies (sys_admin only)
 */
async function getAllUsersWithCompanies() {
  try {
    const { data, error } = await supabase.rpc('get_all_users_with_companies');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

/**
 * Get all companies (sys_admin only)
 */
async function getAllCompanies() {
  try {
    const { data, error } = await supabase.rpc('get_all_companies');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error getting companies:', error);
    throw error;
  }
}

/**
 * Get all team members (regular admin)
 */
async function getTeamMembers() {
  try {
    const members = await teamService.getTeamMembers();

    // Transform to expected format and filter out sys_admin users
    return members
      .filter(member => member.role !== 'sys_admin') // Regular admins shouldn't see sys_admins
      .map(member => ({
        id: member.id,
        email: member.email,
        full_name: member.full_name || member.email,
        role: member.role,
        status: member.status,
        company_id: null,
        company_name: null
      }));
  } catch (error) {
    console.error('Error getting team members:', error);
    throw error;
  }
}

/**
 * Create a new team member
 */
async function createMember({ email, full_name, password, role, company_name }) {
  try {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) throw new Error('Not authenticated');

    // Check if current user has a company
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', currentUser.id)
      .single();

    let companyId = currentProfile?.company_id;

    // If admin doesn't have a company yet and provided a company name, create one
    if (!companyId && company_name && currentProfile?.role === 'admin') {
      const { data: newCompanyId, error: companyError } = await supabase
        .rpc('create_company_for_admin', { company_name });

      if (companyError) throw companyError;

      companyId = newCompanyId;
      console.log('Created company and assigned to current user, id:', companyId);
    }

    // Sign up the new user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role
        }
      }
    });

    if (error) throw error;

    // Assign company to new user if we have one
    if (companyId && data.user) {
      const { error: assignError } = await supabase
        .from('profiles')
        .update({ company_id: companyId })
        .eq('id', data.user.id);

      if (assignError) throw assignError;
    }

    console.log('User created:', data);
  } catch (error) {
    console.error('Error creating member:', error);
    throw error;
  }
}

/**
 * Update team member
 */
async function updateMember(memberId, { full_name, role }) {
  console.log('Updating member:', memberId, 'with role:', role);

  try {
    // Update role in profiles table
    const { data, error: profileError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', memberId)
      .select();

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw profileError;
    }

    console.log('Profile updated successfully:', data);

    // Note: We can't update user_metadata (full_name) from client side
    // This would need to be handled by a backend API or Edge Function
    console.log('Note: Full name updates require backend API support');
  } catch (error) {
    console.error('Error in updateMember:', error);
    throw error;
  }
}

/**
 * Reset user password (sys_admin only)
 */
async function resetUserPassword(userId, newPassword) {
  console.log('Resetting password for user:', userId);

  try {
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
        body: JSON.stringify({
          userId,
          newPassword,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to reset password');
    }

    console.log('Password reset successfully');
  } catch (error) {
    console.error('Error in resetUserPassword:', error);
    throw error;
  }
}

/**
 * Delete team member (from both auth.users and profiles)
 */
async function deleteMember(memberId) {
  console.log('Deleting member:', memberId);

  try {
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
        body: JSON.stringify({
          userId: memberId,
        }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete user');
    }

    console.log('User deleted successfully from both auth and profiles tables');
  } catch (error) {
    console.error('Error in deleteMember:', error);
    throw error;
  }
}
