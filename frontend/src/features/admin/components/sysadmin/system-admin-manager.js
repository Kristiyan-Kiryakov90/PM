/**
 * System Admin Manager - Main Orchestrator
 * Manages tabs, state, and coordinates user/company modules
 */

import { uiHelpers } from '@utils/ui-helpers.js';
import {
  checkSysAdmin,
  getAllUsersWithCompanies,
  getAllCompanies
} from './system-admin-shared.js';
import {
  renderUsersTab,
  showUserForm,
  handleResetPassword,
  handleDeleteUser
} from './system-admin-users.js';
import {
  renderCompaniesTab,
  showCompanyForm,
  handleDeleteCompany
} from './system-admin-companies.js';

/**
 * Render system admin manager in a container
 * @param {HTMLElement} container - Container element
 */
export async function renderSystemAdminManager(container) {
  if (!container) return;

  // State
  let allUsers = [];
  let allCompanies = [];
  let currentUserId = null;
  let selectedCompanyFilter = 'all';
  let activeSubTab = 'users'; // 'users' or 'companies'

  /**
   * Main render function
   */
  async function render() {
    try {
      // Check permissions
      const { isSysAdmin, currentUserId: userId } = await checkSysAdmin();
      currentUserId = userId;

      if (!isSysAdmin) {
        container.innerHTML = '<div class="alert alert-danger">Access denied. System admin privileges required.</div>';
        uiHelpers.showError('Access denied. System admin privileges required.');
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

      // Render main HTML
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
            ${renderUsersTab(filteredUsers, allCompanies, selectedCompanyFilter)}
          </div>

          <!-- Companies Tab -->
          <div class="system-admin-content ${activeSubTab === 'companies' ? 'active' : ''}">
            ${renderCompaniesTab(allCompanies)}
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

  /**
   * Setup event listeners
   */
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
        showUserForm(null, allUsers, allCompanies, render);
        return;
      }

      // Edit user
      const editUserBtn = e.target.closest('.edit-user');
      if (editUserBtn) {
        e.preventDefault();
        const userId = editUserBtn.dataset.userId;
        showUserForm(userId, allUsers, allCompanies, render);
        return;
      }

      // Reset password
      const resetPasswordBtn = e.target.closest('.reset-password');
      if (resetPasswordBtn) {
        e.preventDefault();
        const userId = resetPasswordBtn.dataset.userId;
        await handleResetPassword(userId, allUsers);
        return;
      }

      // Delete user
      const deleteUserBtn = e.target.closest('.delete-user');
      if (deleteUserBtn) {
        e.preventDefault();
        const userId = deleteUserBtn.dataset.userId;
        await handleDeleteUser(userId, allUsers, render);
        return;
      }

      // Create company
      if (e.target.closest('#createCompanyBtn')) {
        e.preventDefault();
        showCompanyForm(null, allCompanies, render);
        return;
      }

      // Edit company
      const editCompanyBtn = e.target.closest('.edit-company');
      if (editCompanyBtn) {
        e.preventDefault();
        const companyId = editCompanyBtn.dataset.companyId;
        showCompanyForm(companyId, allCompanies, render);
        return;
      }

      // Delete company
      const deleteCompanyBtn = e.target.closest('.delete-company');
      if (deleteCompanyBtn) {
        e.preventDefault();
        const companyId = deleteCompanyBtn.dataset.companyId;
        await handleDeleteCompany(companyId, allCompanies, render);
        return;
      }
    });
  }

  // Initial render
  await render();

  return { render };
}
