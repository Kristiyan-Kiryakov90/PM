/**
 * Admin Page (admin.html)
 * Company admin functions: manage team, tags, workflow, and system admin
 */

// Import styles
import '@styles/global/global.css';
import '@styles/shared/navbar.css';
import '@styles/shared/notifications.css';
import '@admin/styles/admin.css';
import '@styles/shared/tags.css';
import '@admin/styles/kanban-settings.css';

import { renderNavbar } from '@components/navbar.js';
import { router } from '@utils/router.js';
import { authUtils } from '@utils/auth.js';
import { uiHelpers } from '@utils/ui-helpers.js';
import { renderTagManager } from '@admin/components/tag-manager-admin.js';
import { renderTeamMemberManager } from '@admin/components/team/team-manager-admin.js';
import { renderSystemAdminManager } from '@admin/components/sysadmin/system-admin-manager.js';
import { renderWorkflowManager } from '@admin/components/workflow-manager-admin.js';
import supabase from '@services/supabase.js';

let tagManagerInitialized = false;
let teamManagerInitialized = false;
let workflowManagerInitialized = false;
let sysadminManagerInitialized = false;
let isSysAdmin = false;

async function init() {
  try {
    // Ensure user is authenticated and is admin
    await router.requireAdmin();

    // Render navbar
    await renderNavbar();

    // Load user info and check for sys_admin
    const metadata = await authUtils.getUserMetadata();
    console.log('Admin user:', metadata);

    // Check if user is sys_admin
    await checkSysAdmin();

    // Setup tab switching
    setupTabs();

    // Tags will be loaded when user clicks the Tags tab
  } catch (error) {
    console.error('Admin page initialization error:', error);
    uiHelpers.showError('Failed to load admin panel. Please refresh the page.');
  }
}

async function checkSysAdmin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    isSysAdmin = profile?.role === 'sys_admin';

    // Show/hide sys_admin tab
    const sysadminTab = document.getElementById('sysadminTab');
    if (sysadminTab && isSysAdmin) {
      sysadminTab.style.display = 'block';
    }
  } catch (error) {
    console.error('Error checking sys_admin status:', error);
  }
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const tabContents = document.querySelectorAll('.admin-tab-content');

  console.log('Setting up tabs:', tabButtons.length, 'buttons found');
  console.log('Tab contents:', tabContents.length, 'content areas found');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tabName = btn.getAttribute('data-tab');
      console.log('Tab clicked:', tabName);

      // Remove active from all buttons and contents
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      // Add active to clicked button and corresponding content
      btn.classList.add('active');
      const tabContent = document.getElementById(tabName + '-tab');
      if (tabContent) {
        tabContent.classList.add('active');
        console.log('Activated tab content:', tabName + '-tab');
      } else {
        console.error('Tab content not found:', tabName + '-tab');
      }

      // Load tab-specific content
      if (tabName === 'team' && !teamManagerInitialized) {
        console.log('Loading team manager...');
        await loadTeamManager();
      } else if (tabName === 'tags' && !tagManagerInitialized) {
        console.log('Loading tag manager...');
        await loadTagManager();
      } else if (tabName === 'workflow' && !workflowManagerInitialized) {
        console.log('Loading workflow manager...');
        await loadWorkflowManager();
      } else if (tabName === 'sysadmin' && !sysadminManagerInitialized) {
        console.log('Loading system admin manager...');
        await loadSysAdminManager();
      }
    });
  });

  // Load team manager by default on page load
  console.log('Loading team manager on page load...');
  loadTeamManager();
}

async function loadTeamManager() {
  const teamContainer = document.getElementById('teamContainer');
  console.log('loadTeamManager - container found:', !!teamContainer);

  if (!teamContainer) {
    console.error('Team container not found!');
    return;
  }

  teamContainer.innerHTML = '<p class="text-center">Loading team members...</p>';

  try {
    console.log('Calling renderTeamMemberManager...');
    await renderTeamMemberManager(teamContainer);
    teamManagerInitialized = true;
    console.log('Team manager loaded successfully');
  } catch (error) {
    console.error('Failed to load team manager:', error);
    teamContainer.innerHTML = `
      <div class="alert alert-danger">
        <h5>Failed to load team manager</h5>
        <p>${error.message || 'Unknown error'}</p>
        <button class="btn btn-sm btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

async function loadTagManager() {
  const tagsContainer = document.getElementById('tagsContainer');
  if (!tagsContainer) return;

  try {
    await renderTagManager(tagsContainer);
    tagManagerInitialized = true;
  } catch (error) {
    console.error('Failed to load tag manager:', error);
    tagsContainer.innerHTML = `
      <div class="text-center text-danger">
        <p>Failed to load tag manager</p>
        <button class="btn btn-sm btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

async function loadWorkflowManager() {
  const workflowContainer = document.getElementById('workflowContainer');
  if (!workflowContainer) return;

  try {
    await renderWorkflowManager(workflowContainer);
    workflowManagerInitialized = true;
  } catch (error) {
    console.error('Failed to load workflow manager:', error);
    workflowContainer.innerHTML = `
      <div class="text-center text-danger">
        <p>Failed to load workflow manager</p>
        <button class="btn btn-sm btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

async function loadSysAdminManager() {
  const sysadminContainer = document.getElementById('sysadminContainer');
  if (!sysadminContainer) return;

  if (!isSysAdmin) {
    sysadminContainer.innerHTML = `
      <div class="alert alert-danger">
        <p>Access denied. System admin privileges required.</p>
      </div>
    `;
    return;
  }

  try {
    await renderSystemAdminManager(sysadminContainer);
    sysadminManagerInitialized = true;
  } catch (error) {
    console.error('Failed to load system admin manager:', error);
    sysadminContainer.innerHTML = `
      <div class="text-center text-danger">
        <p>Failed to load system admin manager</p>
        <button class="btn btn-sm btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

init();
