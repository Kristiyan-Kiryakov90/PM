/**
 * Team Manager - Member Form Handlers
 * Handles member creation and editing form modal
 */

import { Modal } from 'bootstrap';
import { uiHelpers } from '@utils/ui-helpers.js';
import { showPasswordResetModal } from './team-manager-password-reset.js';
import {
  createMember,
  updateMember,
  sendPasswordResetEmail
} from './team-manager-actions.js';
import {
  renderEmailField,
  renderEmailFieldDisabled,
  renderCompanyFieldDisabled,
  renderNameFields,
  renderPasswordField,
  renderPasswordFieldWithReset,
  renderCompanyField,
  renderRoleField
} from './team-manager-member-form-templates.js';

/**
 * Show member form modal (create or edit)
 * @param {Object} params - Form parameters
 */
export function showMemberForm({
  member = null,
  allMembers,
  currentUserId,
  currentUserCompany,
  isSysAdmin,
  onSave
}) {
  const editingMemberId = member?.id || null;
  const fullName = member?.full_name || '';
  const role = member?.role || 'user';
  const isEditingSelf = member && member.id === currentUserId;

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
              ${!member ? renderEmailField() : renderEmailFieldDisabled(member.email)}

              ${member ? renderCompanyFieldDisabled(member.company_name) : ''}

              ${renderNameFields(firstName, lastName)}

              ${!member ? renderPasswordField() : renderPasswordFieldWithReset(isSysAdmin)}

              ${!isSysAdmin && !member ? renderCompanyField(currentUserCompany) : ''}

              ${renderRoleField(member, role, isEditingSelf, isSysAdmin)}
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
  setupFormListeners({
    existingMember: member,
    editingMemberId,
    allMembers,
    currentUserId,
    currentUserCompany,
    isSysAdmin,
    onSave
  });
}

/**
 * Setup form event listeners
 */
function setupFormListeners({
  existingMember,
  editingMemberId,
  allMembers,
  currentUserId,
  currentUserCompany,
  isSysAdmin,
  onSave
}) {
  const modalElement = document.getElementById('memberFormModal');
  const emailInput = document.getElementById('memberEmailInput');
  const firstNameInput = document.getElementById('memberFirstNameInput');
  const lastNameInput = document.getElementById('memberLastNameInput');
  const passwordInput = document.getElementById('memberPasswordInput');
  const roleInput = document.getElementById('memberRoleInput');
  const saveBtn = document.getElementById('saveMemberBtn');
  const resetPasswordInlineBtn = document.getElementById('resetPasswordInlineBtn');
  const sendPasswordResetEmailBtn = document.getElementById('sendPasswordResetEmailBtn');

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

  // Reset password inline button (sys_admin only)
  resetPasswordInlineBtn?.addEventListener('click', () => {
    if (existingMember) {
      const fullName = existingMember.full_name || existingMember.email;
      showPasswordResetModal(existingMember.id, fullName);
    }
  });

  // Send password reset email button (regular admin)
  sendPasswordResetEmailBtn?.addEventListener('click', async () => {
    if (!existingMember) return;

    const fullName = existingMember.full_name || existingMember.email;
    const email = existingMember.email;

    if (!confirm(`Send password reset email to ${fullName} (${email})?`)) {
      return;
    }

    sendPasswordResetEmailBtn.disabled = true;
    sendPasswordResetEmailBtn.textContent = 'Sending...';

    try {
      await sendPasswordResetEmail(email);
      uiHelpers.showSuccess(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      uiHelpers.showError(error.message || 'Failed to send password reset email');
    } finally {
      sendPasswordResetEmailBtn.disabled = false;
      sendPasswordResetEmailBtn.textContent = '📧 Send Reset Email';
    }
  });

  // Save button
  saveBtn?.addEventListener('click', async () => {
    await handleSaveMember({
      emailInput,
      firstNameInput,
      lastNameInput,
      passwordInput,
      roleInput,
      saveBtn,
      modal,
      existingMember,
      editingMemberId,
      allMembers,
      currentUserId,
      currentUserCompany,
      isSysAdmin,
      onSave
    });
  });
}

/**
 * Handle save member button click
 */
async function handleSaveMember({
  emailInput,
  firstNameInput,
  lastNameInput,
  passwordInput,
  roleInput,
  saveBtn,
  modal,
  existingMember,
  editingMemberId,
  allMembers,
  currentUserId,
  currentUserCompany,
  isSysAdmin,
  onSave
}) {
  console.log('Save button clicked');

  const email = emailInput?.value.trim();
  const firstName = firstNameInput?.value.trim();
  const lastName = lastNameInput?.value.trim();
  const companyName = document.getElementById('memberCompanyInput')?.value.trim();
  const role = roleInput?.value;

  console.log('Form values:', { firstName, lastName, companyName, role });

  if (!firstName) {
    uiHelpers.showError('First name is required');
    return;
  }

  if (!lastName) {
    uiHelpers.showError('Last name is required');
    return;
  }

  // For regular admins without a company, company name is required ONLY when creating new users
  if (!isSysAdmin && !existingMember && !currentUserCompany && !companyName) {
    uiHelpers.showError('Company name is required');
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
      uiHelpers.showError('Email is required');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Member';
      return;
    }

    if (!password || password.length < 8) {
      uiHelpers.showError('Password must be at least 8 characters');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Member';
      return;
    }

    try {
      console.log('Creating member:', { email, full_name: fullName, company_name: companyName, role });
      await createMember({ email, full_name: fullName, password, role, company_name: companyName });
      uiHelpers.showSuccess('Team member added');
      modal.hide();
      if (onSave) await onSave();
    } catch (error) {
      console.error('Error saving member:', error);
      uiHelpers.showError(error.message || 'Failed to add team member');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Member';
    }
  } else {
    // Editing existing user
    try {
      // Don't allow changing sys_admin role
      const memberToUpdate = allMembers.find(m => m.id === editingMemberId);
      let finalRole = memberToUpdate?.role === 'sys_admin' ? 'sys_admin' : role;

      // Prevent admin from downgrading their own role
      if (editingMemberId === currentUserId && memberToUpdate?.role === 'admin' && role !== 'admin') {
        uiHelpers.showError('You cannot change your own role. Ask another admin to change your role if needed.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Member';
        return;
      }

      // Keep admin role if editing self
      if (editingMemberId === currentUserId && memberToUpdate?.role === 'admin') {
        finalRole = 'admin';
      }

      console.log('Updating member:', editingMemberId, { full_name: fullName, role: finalRole });
      await updateMember(editingMemberId, { full_name: fullName, role: finalRole });
      uiHelpers.showSuccess('Team member updated');
      modal.hide();
      if (onSave) await onSave();
    } catch (error) {
      console.error('Error saving member:', error);
      uiHelpers.showError(error.message || 'Failed to update team member');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Update Member';
    }
  }
}
