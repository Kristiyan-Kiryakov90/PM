/**
 * Navbar Component
 * Shared navigation for all protected pages with role-based links
 */

import { getUserMetadata, signOut, getUserFullName } from '@utils/auth.js';
import { NotificationCenter } from './notification-center.js';

/**
 * Render navbar HTML and inject into page
 * @returns {Promise<void>}
 */
export async function renderNavbar() {
  const metadata = await getUserMetadata();
  if (!metadata) return;

  // Use metadata to get full name instead of calling getUserMetadata again
  const userFullName = `${metadata.first_name} ${metadata.last_name}`.trim() || metadata.email;
  const isAdmin = metadata.role === 'admin' || metadata.role === 'sys_admin';

  const navbarHTML = `
    <nav class="navbar">
      <div class="navbar-container">
        <!-- Logo -->
        <div class="navbar-brand">
          <a href="/public/dashboard.html" class="navbar-logo">
            <span class="navbar-logo-icon">📊</span>
            <span class="navbar-logo-text">TaskFlow</span>
          </a>
        </div>

        <!-- Navigation Links -->
        <div class="navbar-menu">
          <a href="/public/dashboard.html" class="navbar-link">Dashboard</a>
          <a href="/public/projects.html" class="navbar-link">Projects</a>
          <a href="/public/tasks.html" class="navbar-link">Tasks</a>
          <a href="/public/reports.html" class="navbar-link">Reports</a>
          ${isAdmin ? `<a href="/public/admin.html" class="navbar-link navbar-link-admin">Admin</a>` : ''}
        </div>

        <!-- User Menu -->
        <div class="navbar-user">
          <!-- Notification Center -->
          <div id="notificationCenter"></div>

          <div class="user-profile-dropdown">
            <button class="user-profile-button" id="userMenuToggle">
              <span class="user-avatar">${getInitials(userFullName)}</span>
              <span class="user-name">${userFullName}</span>
              <svg class="dropdown-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="user-menu" id="userMenu">
              <a href="/public/profile.html" class="user-menu-link">
                <span class="menu-icon">👤</span>
                <span>Profile</span>
              </a>
              <button class="user-menu-link user-menu-signout" id="signoutBtn">
                <span class="menu-icon">🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Menu Toggle -->
        <button class="navbar-toggle" id="navbarToggle">
          <span class="hamburger-icon"></span>
          <span class="hamburger-icon"></span>
          <span class="hamburger-icon"></span>
        </button>
      </div>
    </nav>
  `;

  // Insert navbar at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', navbarHTML);

  // Add navbar CSS if not already loaded
  if (!document.querySelector('link[href*="navbar.css"]')) {
    const navbarCSS = document.createElement('link');
    navbarCSS.rel = 'stylesheet';
    navbarCSS.href = '/src/css/navbar.css';
    document.head.appendChild(navbarCSS);
  }

  // Add notification CSS if not already loaded
  if (!document.querySelector('link[href*="notifications.css"]')) {
    const notificationCSS = document.createElement('link');
    notificationCSS.rel = 'stylesheet';
    notificationCSS.href = '/src/css/notifications.css';
    document.head.appendChild(notificationCSS);
  }

  // Setup event listeners
  setupNavbarEvents();

  // Initialize notification center
  new NotificationCenter('notificationCenter');
}

/**
 * Setup navbar event listeners
 */
function setupNavbarEvents() {
  // User menu toggle
  const userMenuToggle = document.getElementById('userMenuToggle');
  const userMenu = document.getElementById('userMenu');
  const signoutBtn = document.getElementById('signoutBtn');
  const navbarToggle = document.getElementById('navbarToggle');
  const navbarMenu = document.querySelector('.navbar-menu');

  if (userMenuToggle && userMenu) {
    userMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('active');
    });
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.parentElement.contains(e.target)) {
      userMenu.classList.remove('active');
    }
  });

  // Sign out
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Sign out error:', error);
        alert('Error signing out. Please try again.');
      }
    });
  }

  // Mobile menu toggle
  if (navbarToggle && navbarMenu) {
    navbarToggle.addEventListener('click', () => {
      navbarMenu.classList.toggle('active');
    });
  }

  // Close mobile menu when clicking a link
  const navbarLinks = document.querySelectorAll('.navbar-link');
  navbarLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (navbarMenu) {
        navbarMenu.classList.remove('active');
      }
    });
  });

  // Set active link based on current page
  const currentPath = window.location.pathname;
  navbarLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (currentPath.includes(href.split('/').pop())) {
      link.classList.add('active');
    }
  });
}

/**
 * Get user initials from full name
 * @param {string} fullName - Full name
 * @returns {string} Initials (e.g., "JD")
 */
function getInitials(fullName) {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(' ');
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2);
}
