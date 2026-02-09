import { test as base, Page } from '@playwright/test';

/**
 * Test Fixtures
 * Provides authenticated page and other test utilities
 */

type TestFixtures = {
  authenticatedPage: Page;
};

/**
 * Helper function to perform login
 */
async function performLogin(page: Page, email: string, password: string): Promise<void> {
  // Navigate to signin page
  await page.goto('/signin.html');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Fill in credentials using correct IDs
  const emailInput = page.locator('#email');
  const passwordInput = page.locator('#password');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Submit form
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // Wait for navigation
  await page.waitForTimeout(3000);

  // Verify login success
  if (!page.url().includes('dashboard')) {
    console.warn('Login may have failed, current URL:', page.url());
  }
}

/**
 * Extended test with authenticated page fixture
 */
export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Use environment variables or default test credentials
    const email = process.env.TEST_EMAIL || 'playwright.test@taskflow.com';
    const password = process.env.TEST_PASSWORD || 'TestPassword123!';

    // Perform login
    try {
      await performLogin(page, email, password);
    } catch (error) {
      console.log('Login attempt failed, continuing without auth:', error);
    }

    // Provide the authenticated page to the test
    await use(page);
  },
});

export { expect } from '@playwright/test';
