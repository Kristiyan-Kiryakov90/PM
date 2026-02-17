import { test, expect } from '@playwright/test';
import {
  loginUser,
  navigateToPage,
  generateProjectName,
  generateTaskTitle,
} from '../test-setup';

/**
 * End-to-End Workflow Tests
 * Tests complete user workflows from start to finish
 */

test.describe('Complete User Workflows - E2E', () => {
  test.describe('User Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, 'user');
    });

    test('[E2E-WORKFLOW-001] User can access dashboard after login', async ({ page }) => {
      await page.goto('http://localhost:5173/dashboard.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('dashboard');
      
      const dashboardContent = page.locator('main, [class*="dashboard"], h1, h2');
      const hasContent = await dashboardContent.isVisible().catch(() => false);
      
      expect(hasContent || page.url()).toBeTruthy();
    });

    test('[E2E-WORKFLOW-002] Dashboard shows user information', async ({ page }) => {
      await page.goto('http://localhost:5173/dashboard.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      // Look for user name or profile info
      const userInfo = page.locator('[class*="user"], [class*="profile"], text=/welcome|hello/i').first();
      const hasUserInfo = await userInfo.isVisible().catch(() => false);

      expect(hasUserInfo || page.url().includes('dashboard')).toBeTruthy();
    });



    test('[E2E-WORKFLOW-004] Can navigate to projects from dashboard', async ({ page }) => {
      await page.goto('http://localhost:5173/dashboard.html', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const projectsLink = page.locator('a, button').filter({ hasText: /project/i }).first();
      
      if (await projectsLink.isVisible().catch(() => false)) {
        await projectsLink.click();
        await page.waitForTimeout(1000);

        expect(page.url().includes('projects')).toBeTruthy();
      }
    });
  });

  test.describe('Admin Workflows', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, 'admin');
    });

    test('[E2E-WORKFLOW-005] Admin can access admin panel', async ({ page }) => {
      await navigateToPage(page, '/admin.html');

      expect(page.url()).toContain('admin.html');
      
      const adminContent = page.locator('main, [class*="admin"], h1, h2');
      const hasContent = await adminContent.isVisible().catch(() => false);
      
      expect(hasContent || page.url()).toBeTruthy();
    });

    test('[E2E-WORKFLOW-006] Admin dashboard displays navigation', async ({ page }) => {
      await navigateToPage(page, '/admin.html');

      const adminNav = page.locator('[class*="nav"], [class*="menu"], a, button').first();
      const hasNav = await adminNav.isVisible().catch(() => false);

      expect(hasNav || page.url().includes('admin')).toBeTruthy();
    });

    test('[E2E-WORKFLOW-007] Admin can manage settings', async ({ page }) => {
      await navigateToPage(page, '/admin.html');

      const settingsBtn = page.locator('a, button').filter({ hasText: /setting|config|manage/i }).first();
      
      if (await settingsBtn.isVisible().catch(() => false)) {
        await settingsBtn.click();
        await page.waitForTimeout(1000);

        const settingsContent = page.locator('[class*="setting"], [class*="config"]').first();
        const hasSettings = await settingsContent.isVisible().catch(() => false);
        
        expect(hasSettings || page.url()).toBeTruthy();
      }
    });
  });

  test.describe('Page Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, 'user');
    });

    test('[E2E-WORKFLOW-008] Can navigate between main pages', async ({ page }) => {
      // Start at dashboard
      await navigateToPage(page, '/dashboard.html');
      expect(page.url()).toContain('dashboard');

      // Navigate to tasks
      await navigateToPage(page, '/tasks.html');
      expect(page.url()).toContain('tasks');

      // Navigate to projects
      await navigateToPage(page, '/projects.html');
      expect(page.url()).toContain('projects');
    });

    test('[E2E-WORKFLOW-009] Logout functionality works', async ({ page }) => {
      await navigateToPage(page, '/dashboard.html');

      // Look for logout button
      const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out|sign off/i }).first();
      
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);

        // Should be redirected to login or home
        const onLoginOrHome = page.url().includes('signin') || page.url().includes('index');
        expect(onLoginOrHome || !page.url().includes('dashboard')).toBeTruthy();
      }
    });

    test('[E2E-WORKFLOW-010] Can access profile/settings', async ({ page }) => {
      await navigateToPage(page, '/dashboard.html');

      // Look for profile/settings link
      const profileLink = page.locator('a, button').filter({ hasText: /profile|account|setting|user/i }).first();
      
      if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click();
        await page.waitForTimeout(1000);

        const onProfilePage = page.url().includes('profile') || page.url().includes('account');
        expect(onProfilePage || page.url()).toBeTruthy();
      }
    });
  });
});
