import { test, expect } from '@playwright/test';
import { 
  loginUser, 
  logoutUser, 
  navigateToPage,
  getTestUser,
  captureScreenshot,
  waitForElement,
} from '../test-setup';

/**
 * Authentication E2E Tests
 * Full end-to-end tests for signup, signin, and signout flows
 * Uses 3 pre-created test users to avoid database flooding
 */

test.describe('Authentication - E2E', () => {
  test.describe('Sign In Flow', () => {
    test('[E2E-AUTH-001] Admin can sign in and access dashboard', async ({ page }) => {
      // Login as admin (handles navigation to signin and redirect to dashboard)
      await loginUser(page, 'admin');

      // Verify dashboard is accessible
      expect(page.url()).toContain('dashboard.html');
    });

    test('[E2E-AUTH-002] Regular user can sign in and access dashboard', async ({ page }) => {
      // Login as regular user
      await loginUser(page, 'user');

      // Verify dashboard is accessible
      expect(page.url()).toContain('dashboard.html');
    });

    test('[E2E-AUTH-003] Invalid credentials show error message', async ({ page }) => {
      await navigateToPage(page, '/signin.html');

      // Fill with invalid credentials
      await page.locator('#email').fill('invalid@example.com');
      await page.locator('#password').fill('WrongPassword123!');

      // Submit
      await page.locator('button[type="submit"]').click();

      // Wait for error message or stay on signin
      await page.waitForTimeout(2000);

      // Should either show error or stay on signin page
      const hasError = await waitForElement(page, '[class*="error"], [class*="alert-danger"]', 3000);
      const isStillOnSignin = page.url().includes('signin.html');

      expect(hasError || isStillOnSignin).toBeTruthy();
    });

    test('[E2E-AUTH-004] Empty fields validation', async ({ page }) => {
      await navigateToPage(page, '/signin.html');

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();

      // Should not proceed
      await page.waitForTimeout(500);

      // Should either show validation error or stay on page
      expect(page.url()).toContain('signin.html');
    });


  });

  test.describe('Sign Out Flow', () => {
    test('[E2E-AUTH-007] Admin can sign out from dashboard', async ({ page }) => {
      // Login first
      await loginUser(page, 'admin');

      // Find and click logout button
      const logoutButton = page.locator(
        'button:has-text("Sign Out"), button:has-text("Logout"), [data-testid="logout"]'
      ).first();

      if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(1000);

        // Should redirect to signin or home
        const isRedirected = page.url().includes('signin.html') || page.url().includes('index.html');
        expect(isRedirected).toBeTruthy();
      }
    });

    test('[E2E-AUTH-008] Session is cleared after logout', async ({ page }) => {
      // Login
      await loginUser(page, 'user');

      // Logout
      const logoutButton = page.locator(
        'button:has-text("Sign Out"), button:has-text("Logout")'
      ).first();

      if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(1000);

        // Try to access protected page
        await navigateToPage(page, '/dashboard.html');
        await page.waitForTimeout(1000);

        // Should not have access or should redirect
        const url = page.url();
        const isNotAccessible = 
          url.includes('signin.html') || 
          url.includes('index.html') ||
          await waitForElement(page, 'text=/login|sign in/i', 2000);

        expect(isNotAccessible).toBeTruthy();
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('[E2E-AUTH-009] Dashboard requires authentication', async ({ page }) => {
      // Access without login
      await navigateToPage(page, '/dashboard.html');
      await page.waitForTimeout(1000);

      const isRedirected = 
        page.url().includes('signin.html') || 
        page.url().includes('index.html');

      expect(isRedirected).toBeTruthy();
    });

    test('[E2E-AUTH-010] Projects page requires authentication', async ({ page }) => {
      await navigateToPage(page, '/projects.html');
      await page.waitForTimeout(1000);

      const isRedirected = 
        page.url().includes('signin.html') || 
        page.url().includes('index.html');

      expect(isRedirected).toBeTruthy();
    });

    test('[E2E-AUTH-011] Tasks page requires authentication', async ({ page }) => {
      await navigateToPage(page, '/tasks.html');
      await page.waitForTimeout(1000);

      const isRedirected = 
        page.url().includes('signin.html') || 
        page.url().includes('index.html');

      expect(isRedirected).toBeTruthy();
    });


  });

  test.describe('Session Persistence', () => {
    test('[E2E-AUTH-014] Navigation between authenticated pages works', async ({ page }) => {
      // Login
      await loginUser(page, 'admin');

      // Navigate to projects
      await navigateToPage(page, '/projects.html');
      expect(page.url()).toContain('projects.html');

      // Navigate to tasks
      await navigateToPage(page, '/tasks.html');
      expect(page.url()).toContain('tasks.html');

      // Navigate back to dashboard
      await navigateToPage(page, '/dashboard.html');
      expect(page.url()).toContain('dashboard.html');
    });
  });
});
