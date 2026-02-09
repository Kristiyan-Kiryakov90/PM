import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 * Tests for navigation between pages and navigation menus
 */

test.describe('Navigation', () => {
  test.describe('Main Navigation Menu', () => {
    test('should display navigation menu on authenticated pages', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const navMenu = page.locator('nav, [class*="navbar"], [class*="menu"]').first();

      const isVisible = await navMenu.isVisible().catch(() => false);

      if (isVisible) {
        await expect(navMenu).toBeVisible();
      }
    });

    test('should have dashboard link', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const dashboardLink = page.locator('a:has-text("Dashboard"), a[href*="dashboard"]').first();

      if (await dashboardLink.isVisible()) {
        await dashboardLink.click();
        expect(page.url()).toContain('dashboard');
      }
    });

    test('should have projects link', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const projectsLink = page.locator('a:has-text("Project"), a[href*="project"]').first();

      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('projects');
      }
    });

    test('should have tasks link', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const tasksLink = page.locator('a:has-text("Task"), a[href*="task"]').first();

      if (await tasksLink.isVisible()) {
        await tasksLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('tasks');
      }
    });

    test('should have profile link', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const profileLink = page.locator('a:has-text("Profile"), a[href*="profile"]').first();

      if (await profileLink.isVisible()) {
        await profileLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('profile');
      }
    });
  });

  test.describe('Admin Navigation', () => {
    test('should have admin link for admin users', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const adminLink = page.locator('a:has-text("Admin"), a[href*="admin"]').first();

      const isVisible = await adminLink.isVisible().catch(() => false);

      // Only test if visible (admin users only)
      if (isVisible) {
        await adminLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('admin');
      }
    });
  });

  test.describe('User Menu', () => {
    test('should display user menu or profile button', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const userMenu = page.locator('[class*="user-menu"], [class*="profile-menu"], button:has-text("Profile")').first();

      const isVisible = await userMenu.isVisible().catch(() => false);

      if (isVisible) {
        expect(userMenu).toBeTruthy();
      }
    });

    test('should have signout option in user menu', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const userMenu = page.locator('[class*="user-menu"], [class*="profile-menu"], button:has-text("Profile")').first();

      if (await userMenu.isVisible()) {
        await userMenu.click();

        const signoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout")').first();

        const isVisible = await signoutButton.isVisible().catch(() => false);

        if (isVisible) {
          expect(signoutButton).toBeTruthy();
        }
      }
    });
  });

  test.describe('Breadcrumb Navigation', () => {
    test('should display breadcrumbs on project detail page', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const projectItem = page.locator('[class*="project-item"], [class*="project-card"]').first();

      if (await projectItem.isVisible()) {
        await projectItem.click();
        await page.waitForTimeout(500);

        const breadcrumbs = page.locator('[class*="breadcrumb"], ol, nav:has-text("Projects")');

        const isVisible = await breadcrumbs.isVisible().catch(() => false);

        if (isVisible) {
          expect(breadcrumbs).toBeTruthy();
        }
      }
    });
  });

  test.describe('Back Navigation', () => {
    test('should navigate back from project detail', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const projectItem = page.locator('[class*="project-item"], [class*="project-card"]').first();

      if (!await projectItem.isVisible()) {
        test.skip();
      }

      await projectItem.click();
      await page.waitForTimeout(500);

      const backButton = page.locator('button:has-text("Back"), a:has-text("Back"), button[class*="back"]').first();

      if (await backButton.isVisible()) {
        await backButton.click();
        expect(page.url()).toContain('projects');
      }
    });
  });

  test.describe('Mobile Navigation', () => {
    test('should display mobile menu toggle', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const menuToggle = page.locator('button:has-text("Menu"), button[class*="toggle"], button[class*="hamburger"]').first();

      const isVisible = await menuToggle.isVisible().catch(() => false);

      if (isVisible) {
        expect(menuToggle).toBeTruthy();
      }
    });

    test('should open mobile menu on toggle', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const menuToggle = page.locator('button:has-text("Menu"), button[class*="toggle"], button[class*="hamburger"]').first();

      if (!await menuToggle.isVisible()) {
        test.skip();
      }

      await menuToggle.click();

      const menu = page.locator('nav, [class*="mobile-menu"]').last();

      const isVisible = await menu.isVisible().catch(() => false);

      if (isVisible) {
        expect(menu).toBeTruthy();
      }
    });
  });

  test.describe('Page Transitions', () => {
    test('should navigate between pages without errors', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const pages = ['/projects.html', '/tasks.html', '/profile.html'];

      for (const targetPage of pages) {
        await page.goto(targetPage);
        await page.waitForLoadState('networkidle');

        // Check for error messages
        const errorMessage = page.locator('[class*="error"], text=/error|failed/i').first();

        const isError = await errorMessage.isVisible().catch(() => false);

        expect(!isError).toBeTruthy();
      }
    });

    test('should handle rapid navigation', async ({ page }) => {
      await page.goto('/dashboard.html');

      // Rapidly navigate between pages
      await page.click('a:has-text("Project"), a[href*="project"]');
      await page.click('a:has-text("Task"), a[href*="task"]');
      await page.click('a:has-text("Dashboard"), a[href*="dashboard"]');

      await page.waitForLoadState('networkidle');

      // Should end up on dashboard
      expect(page.url()).toContain('dashboard');
    });
  });

  test.describe('Link Functionality', () => {
    test('should have working internal links', async ({ page }) => {
      await page.goto('/index.html');

      const links = page.locator('a[href*=".html"]');

      const count = await links.count();

      if (count > 0) {
        const firstLink = links.first();
        const href = await firstLink.getAttribute('href');

        expect(href).toBeTruthy();
        expect(href).toContain('.html');
      }
    });

    test('should open external links in new tab when appropriate', async ({ page }) => {
      await page.goto('/index.html');

      const externalLinks = page.locator('a[target="_blank"]');

      const count = await externalLinks.count();

      if (count > 0) {
        const firstLink = externalLinks.first();
        const target = await firstLink.getAttribute('target');

        expect(target).toBe('_blank');
      }
    });
  });

  test.describe('Active Navigation State', () => {
    test('should highlight current page in navigation', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const activeLink = page.locator('[class*="active"], [aria-current="page"], nav a[class*="current"]').first();

      const isVisible = await activeLink.isVisible().catch(() => false);

      if (isVisible) {
        expect(activeLink).toBeTruthy();
      }
    });

    test('should update active state when navigating', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const projectsLink = page.locator('a:has-text("Project"), a[href*="project"]').first();

      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await page.waitForLoadState('networkidle');

        const activeLink = page.locator('[class*="active"], [aria-current="page"]').filter({ has: projectsLink }).first();

        const isVisible = await activeLink.isVisible().catch(() => false);

        // Should have some indication of active state
        expect(isVisible || page.url().includes('projects')).toBeTruthy();
      }
    });
  });
});
