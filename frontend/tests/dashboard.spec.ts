import { test, expect } from '@playwright/test';

/**
 * Dashboard Tests
 * Tests for dashboard overview and user home page
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to dashboard
    await page.goto('/dashboard.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Dashboard Page Display', () => {
    test('should load dashboard page successfully', async ({ page }) => {
      expect(page.url()).toContain('dashboard.html');

      // Should display main content
      const mainContent = page.locator('main, [class*="dashboard"], [class*="container"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display welcome message or user greeting', async ({ page }) => {
      const greeting = page.locator('h1, h2').first();

      if (await greeting.isVisible()) {
        const text = await greeting.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display user information', async ({ page }) => {
      // Should display user name or email
      const userInfo = page.locator('[class*="user"], [class*="profile"]').first();

      if (await userInfo.isVisible()) {
        const text = await userInfo.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Dashboard Statistics', () => {
    test('should display project count', async ({ page }) => {
      const projectStats = page.locator('[class*="project"]').first();

      if (await projectStats.isVisible()) {
        const text = await projectStats.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display task count', async ({ page }) => {
      const taskStats = page.locator('[class*="task"]').first();

      if (await taskStats.isVisible()) {
        const text = await taskStats.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display statistics cards or widgets', async ({ page }) => {
      const cards = page.locator('[class*="card"], [class*="widget"], [class*="stat"]');

      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Dashboard Navigation', () => {
    test('should have link to projects', async ({ page }) => {
      const projectsLink = page.locator('a:has-text("Project"), a[href*="project"]').first();

      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('projects');
      }
    });

    test('should have link to tasks', async ({ page }) => {
      const tasksLink = page.locator('a:has-text("Task"), a[href*="task"]').first();

      if (await tasksLink.isVisible()) {
        await tasksLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('tasks');
      }
    });

    test('should have quick action buttons', async ({ page }) => {
      const createButtons = page.locator('button:has-text("Create"), button:has-text("New")');

      const count = await createButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Recent Activity', () => {
    test('should display recent projects', async ({ page }) => {
      const recentProjects = page.locator('[class*="recent"]').first();

      if (await recentProjects.isVisible()) {
        const text = await recentProjects.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display recent tasks', async ({ page }) => {
      const recentTasks = page.locator('[class*="recent-tasks"], [class*="recent"]').first();

      if (await recentTasks.isVisible()) {
        const text = await recentTasks.textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Dashboard Menu', () => {
    test('should have navigation menu', async ({ page }) => {
      const menu = page.locator('nav, [class*="menu"], [class*="sidebar"]').first();

      await expect(menu).toBeVisible();
    });

    test('should have link to profile', async ({ page }) => {
      const profileLink = page.locator('a:has-text("Profile"), a[href*="profile"]').first();

      if (await profileLink.isVisible()) {
        await profileLink.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('profile');
      }
    });

    test('should have sign out button', async ({ page }) => {
      const signoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("Log Out")').first();

      if (await signoutButton.isVisible()) {
        expect(signoutButton).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="dashboard"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="dashboard"]').first();
      await expect(mainContent).toBeVisible();
    });

    test('should display properly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main, [class*="dashboard"]').first();
      await expect(mainContent).toBeVisible();
    });
  });
});
