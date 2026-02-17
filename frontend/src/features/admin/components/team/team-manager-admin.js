/**
 * Team Member Manager - Main Orchestrator
 * Entry point for team member management interface
 * Coordinates state, rendering, and user interactions
 */

import { uiHelpers } from '@utils/ui-helpers.js';
import {
  checkUserPermissions,
  getAllUsersWithCompanies,
  getAllCompanies,
  getTeamMembers,
  applyCompanyFilter
} from './team-manager-filters.js';
import {
  renderTeamManagerHTML,
  renderErrorState
} from './team-manager-ui.js';
import { showMemberForm } from './team-manager-forms.js';
import { showPasswordResetModal } from './team-manager-password-reset.js';
import { deleteMember } from './team-manager-actions.js';

/**
 * Render team member manager in a container
 * @param {HTMLElement} container - Container element
 */
export async function renderTeamMemberManager(container) {
  if (!container) return;

  // State
  let teamMembers = [];
  let allMembers = []; // For filtering
  let companies = [];
  let isSysAdmin = false;
  let currentUserId = null;
  let selectedCompanyFilter = 'all';
  let currentUserCompany = null;

  /**
   * Main render function
   */
  async function render() {
    try {
      console.log('Fetching team members...');

      // Check user permissions
      const permissions = await checkUserPermissions();
      isSysAdmin = permissions.isSysAdmin;
      currentUserId = permissions.currentUserId;
      currentUserCompany = permissions.currentUserCompany;

      // Load data based on permissions
      if (isSysAdmin) {
        // Fetch all users and companies for sys_admin
        [allMembers, companies] = await Promise.all([
          getAllUsersWithCompanies(),
          getAllCompanies()
        ]);
        teamMembers = applyCompanyFilter(allMembers, selectedCompanyFilter);
      } else {
        // Regular admin - fetch only company members
        teamMembers = await getTeamMembers();
        allMembers = teamMembers;
      }

      console.log('Team members fetched:', teamMembers.length, 'members');

      // Render main HTML
      container.innerHTML = renderTeamManagerHTML({
        isSysAdmin,
        teamMembers,
        allMembers,
        companies,
        selectedCompanyFilter,
        currentUserId
      });

      setupEventListeners();
    } catch (error) {
      console.error('Error loading team members:', error);
      container.innerHTML = renderErrorState(error);
    }
  }

  /**
   * Setup event listeners
   */
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

    // Event delegation for all buttons
    container.addEventListener('click', async (e) => {
      // Add member button
      const addBtn = e.target.closest('#addMemberBtn');
      if (addBtn) {
        e.preventDefault();
        console.log('Add member button clicked');
        handleAddMember();
        return;
      }

      // Edit button
      const editBtn = e.target.closest('.edit');
      if (editBtn) {
        e.preventDefault();
        const memberId = editBtn.dataset.memberId;
        console.log('Edit button clicked for member:', memberId);
        handleEditMember(memberId);
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

  /**
   * Handle add member
   */
  function handleAddMember() {
    showMemberForm({
      member: null,
      allMembers,
      currentUserId,
      currentUserCompany,
      isSysAdmin,
      onSave: render
    });
  }

  /**
   * Handle edit member
   */
  function handleEditMember(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    showMemberForm({
      member,
      allMembers,
      currentUserId,
      currentUserCompany,
      isSysAdmin,
      onSave: render
    });
  }

  /**
   * Handle reset password
   */
  async function handleResetPassword(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    const fullName = member.full_name || member.email;
    showPasswordResetModal(memberId, fullName);
  }

  /**
   * Handle delete member
   */
  async function handleDeleteMember(memberId) {
    const member = allMembers.find(m => m.id === memberId);
    if (!member) return;

    const fullName = member.full_name || member.email;

    // Prevent regular admins from deleting sys_admins
    if (!isSysAdmin && member.role === 'sys_admin') {
      uiHelpers.showError('Cannot delete system administrator. Contact a system admin.');
      return;
    }

    // Prevent deleting yourself
    if (member.id === currentUserId) {
      uiHelpers.showError('Cannot delete yourself.');
      return;
    }

    if (!confirm(`Remove ${fullName} from ${isSysAdmin ? 'the system' : 'your company'}? They will lose access to all projects and tasks.\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMember(memberId);
      uiHelpers.showSuccess('Team member removed');
      await render();
    } catch (error) {
      console.error('Error deleting member:', error);
      uiHelpers.showError(error.message || 'Failed to remove team member');
    }
  }

  // Initial render
  await render();

  return {
    render,
  };
}
