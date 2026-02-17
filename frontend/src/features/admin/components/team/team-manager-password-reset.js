/**
 * Team Manager - Password Reset Modal
 * Handles password reset modal for sys_admin
 */

import { Modal } from 'bootstrap';
import { uiHelpers } from '@utils/ui-helpers.js';
import { escapeHtml } from './team-manager-ui.js';
import { resetUserPassword } from './team-manager-actions.js';

/**
 * Show password reset modal
 * @param {string} memberId - Member ID
 * @param {string} fullName - Member full name
 */
export function showPasswordResetModal(memberId, fullName) {
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

/**
 * Setup password reset modal listeners
 */
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
      uiHelpers.showError('Password must be at least 8 characters');
      return;
    }

    resetBtn.disabled = true;
    resetBtn.textContent = 'Resetting...';

    try {
      await resetUserPassword(memberId, newPassword);
      uiHelpers.showSuccess(`Password reset successfully for ${fullName}`);
      modal.hide();
    } catch (error) {
      console.error('Error resetting password:', error);
      uiHelpers.showError(error.message || 'Failed to reset password');
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
