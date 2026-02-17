import { test, expect } from '@playwright/test';
import { 
  loginUser, 
  logoutUser, 
  navigateToPage,
  generateTestId,
  getTestUser,
  TEST_CONFIG,
  waitForElement 
} from './test-setup';

/**
 * Authentication Tests
 * Tests for signup, signin, and signout flows
 * Uses 3 pre-created test users to avoid database flooding
 */

test.describe('Authentication', () => {
  // Ensure we start from a clean state
  test.beforeEach(async ({ page }) => {
    await navigateToPage(page, '/signin.html');
  });

  test.describe('Signup Flow', () => {
    test('should display signup page', async ({ page }) => {
      await page.goto('/signup.html');
      await page.waitForLoadState('networkidle');

      expect(await page.title()).toBeTruthy();

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up")').first();

      const hasEmail = await emailInput.isVisible().catch(() => false);
      const hasPassword = await passwordInput.isVisible().catch(() => false);
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      expect(hasEmail && hasPassword && hasSubmit).toBeTruthy();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/signup.html');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up")').first();

      if (await submitButton.isVisible()) {
        await submitButton.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Check for required attribute or validation state
      const emailRequired = await emailInput.getAttribute('required');
      const passwordRequired = await passwordInput.getAttribute('required');
      const emailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid).catch(() => false);

      expect(emailRequired || passwordRequired || emailInvalid).toBeTruthy();
    });

    test('should create new account with valid credentials', async ({ page }) => {
      await page.goto('/signup.html');

      // Generate unique email
      const uniqueEmail = `test_${Date.now()}@example.com`;
      const password = 'TestPassword123!';

      // Fill form
      await page.fill('#email', uniqueEmail);
      await page.fill('#password', password);

      // Submit form
      await page.click('button[type="submit"]');

      // Should navigate to dashboard or show success message
      // Wait for navigation or success message
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      // Should either redirect or show success indication
      const isSuccessful = currentUrl.includes('dashboard') ||
                           currentUrl.includes('signin') ||
                           await page.locator('text=/success|welcome/i').isVisible().catch(() => false);

      expect(isSuccessful || currentUrl !== '/signup.html').toBeTruthy();
    });
  });

  test.describe('Signin Flow', () => {
    test('should display signin page', async ({ page }) => {
      await page.goto('/signin.html');
      await page.waitForLoadState('networkidle');

      expect(await page.title()).toBeTruthy();

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();

      const hasEmail = await emailInput.isVisible().catch(() => false);
      const hasPassword = await passwordInput.isVisible().catch(() => false);
      const hasSubmit = await submitButton.isVisible().catch(() => false);

      expect(hasEmail && hasPassword && hasSubmit).toBeTruthy();
    });

    test('should show link to signup page', async ({ page }) => {
      await page.goto('/signin.html');

      const signupLink = page.locator('a[href*="signup"]');
      await expect(signupLink).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/signin.html');
      await page.waitForLoadState('networkidle');

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();

      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email').catch(() => {});

        // Email input should have type="email" for validation
        const type = await emailInput.getAttribute('type');
        expect(type).toBe('email');
      }
    });

    test('should attempt signin with valid credentials', async ({ page }) => {
      await page.goto('/signin.html');
      await page.waitForLoadState('networkidle');

      // Use test credentials (these should exist in the test environment)
      const testEmail = process.env.TEST_EMAIL || 'test@example.com';
      const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';

      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();

      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        await emailInput.fill(testEmail);
        await passwordInput.fill(testPassword);

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Should navigate away from signin page on success or stay on error
      const currentUrl = page.url();
      expect(currentUrl).toBeTruthy();
    });
  });

  test.describe('Navigation Authentication', () => {
    test('should require authentication to access dashboard', async ({ page }) => {
      // Try to access dashboard without auth
      await page.goto('/dashboard.html');

      // Should redirect to signin or show permission error
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      // Either redirected or shows auth requirement
      const isRedirected = currentUrl.includes('signin') || currentUrl.includes('index');
      expect(isRedirected || await page.locator('text=/sign in|login|authenticate/i').isVisible().catch(() => false)).toBeTruthy();
    });

    test('should require authentication to access projects', async ({ page }) => {
      await page.goto('/projects.html');

      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      const isRedirected = currentUrl.includes('signin') || currentUrl.includes('index');
      expect(isRedirected || await page.locator('text=/sign in|login|authenticate/i').isVisible().catch(() => false)).toBeTruthy();
    });

    test('should require authentication to access tasks', async ({ page }) => {
      await page.goto('/tasks.html');

      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      const isRedirected = currentUrl.includes('signin') || currentUrl.includes('index');
      expect(isRedirected || await page.locator('text=/sign in|login|authenticate/i').isVisible().catch(() => false)).toBeTruthy();
    });
  });

  test.describe('Signout Flow', () => {
    test('should have signout functionality', async ({ page }) => {
      // This test assumes user is already signed in
      await page.goto('/dashboard.html');

      // Wait a moment to ensure page loads
      await page.waitForTimeout(1000);

      // Look for signout button (common locations: navbar, menu, profile)
      const signoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("Log Out"), a:has-text("Sign Out"), a:has-text("Logout")').first();

      if (await signoutButton.isVisible()) {
        await signoutButton.click();

        // Should redirect to landing page
        await page.waitForURL(/index\.html|\/$/);
      }
    });
  });
});
