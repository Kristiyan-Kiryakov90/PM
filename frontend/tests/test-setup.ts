/**
 * Central Test Setup and Utilities
 * Manages test user setup, authentication, and database cleanup
 * Ensures minimal database pollution by reusing 3 test users with different roles
 */

import { Page, BrowserContext } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const TEST_CONFIG = {
  users: {
    admin: {
      email: process.env.TEST_ADMIN_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
      password: process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin' as const,
    },
    user: {
      email: process.env.TEST_USER_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
      password: process.env.TEST_USER_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'user' as const,
    },
    sysAdmin: {
      email: process.env.TEST_SYSADMIN_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
      password: process.env.TEST_SYSADMIN_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'sys_admin' as const,
    },
  },
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173',
  supabase: {
    url: process.env.VITE_SUPABASE_URL || '',
    key: process.env.VITE_SUPABASE_ANON_KEY || '',
  },
};

/**
 * Test user data for different roles
 */
export type TestUserRole = 'admin' | 'user' | 'sysAdmin';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Get test user credentials by role
 */
export function getTestUser(role: TestUserRole = 'admin'): TestUser {
  return TEST_CONFIG.users[role];
}

/**
 * Get all test users
 */
export function getAllTestUsers(): TestUser[] {
  return Object.values(TEST_CONFIG.users);
}

/**
 * Initialize Supabase client
 */
export function createSupabaseClient(accessToken?: string): SupabaseClient {
  if (!TEST_CONFIG.supabase.url || !TEST_CONFIG.supabase.key) {
    throw new Error(
      'Supabase configuration missing. ' +
      'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in environment. ' +
      `Got url="${TEST_CONFIG.supabase.url}" key="${TEST_CONFIG.supabase.key?.substring(0, 20)}..."`
    );
  }
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return createClient(TEST_CONFIG.supabase.url, TEST_CONFIG.supabase.key, {
    global: { headers },
  });
}

/**
 * Login to application via UI
 */
export async function loginUser(page: Page, role: TestUserRole = 'admin'): Promise<void> {
  const user = getTestUser(role);

  try {
    // Verify page context is alive before navigating
    if (!page || page.isClosed()) {
      throw new Error('Page context is closed before login attempt');
    }

    // Navigate to signin page
    await page.goto(`${TEST_CONFIG.baseURL}/signin.html`, { waitUntil: 'domcontentloaded' }).catch(e => {
      console.error(`Navigation to signin failed: ${e.message}`);
      throw new Error(`Cannot navigate to signin: ${e.message}`);
    });

    // Wait for form to be visible (max 3 seconds)
    const emailInput = page.locator('#email');
    await emailInput.waitFor({ state: 'visible', timeout: 3000 }).catch((e) => {
      console.warn(`Email input not visible on signin page: ${e.message}`);
      throw new Error(`Signin form elements missing: ${e.message}`);
    });

    // Fill credentials
    await emailInput.fill(user.email, { delay: 50 });
    await page.locator('#password').fill(user.password, { delay: 50 });

    // Submit and wait for response
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for multiple possible outcomes after login
    try {
      await Promise.race([
        page.waitForURL('**/dashboard.html', { timeout: 5000 }),
        page.waitForURL('**/admin.html', { timeout: 5000 }),
        page.waitForURL('**/projects.html', { timeout: 5000 }),
        page.waitForURL('**/tasks.html', { timeout: 5000 }),
        // If error appears, that's still a "response" we can work with
        page.locator('#signinError:not(.d-none)').waitFor({ timeout: 3000 }),
        // Fallback: just wait a bit and continue
        new Promise(resolve => setTimeout(resolve, 1500)),
      ]);
    } catch (e) {
      // Log current state for debugging
      console.log('Login: After auth attempt, current URL:', page.url());
    }

    // Give page a moment to settle, but don't wait for full network idle
    // (some pages may be continuously polling)
    await page.waitForTimeout(500);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Login failed for role ${role}: ${errorMsg}`);
    throw error;
  }
}

/**
 * Logout user via UI
 */
export async function logoutUser(page: Page): Promise<void> {
  // Try different logout button selectors
  const logoutButtons = [
    'button:has-text("Sign Out")',
    'button:has-text("Logout")',
    'button:has-text("Log Out")',
    '[data-testid="logout-button"]',
  ];

  for (const selector of logoutButtons) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click();
      await page.waitForTimeout(500);
      return;
    }
  }
}

/**
 * Authenticate request with user token via API
 */
export async function authenticateAsUser(
  supabase: SupabaseClient,
  role: TestUserRole = 'admin'
): Promise<string> {
  const user = getTestUser(role);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error || !data.session) {
    throw new Error(`Failed to authenticate as ${role}: ${error?.message}`);
  }

  return data.session.access_token;
}

/**
 * Create authenticated Supabase client for user
 */
export async function getAuthenticatedClient(
  role: TestUserRole = 'admin'
): Promise<SupabaseClient> {
  const supabase = createSupabaseClient();
  const token = await authenticateAsUser(supabase, role);
  return createSupabaseClient(token);
}

/**
 * Clean up test data created by tests
 * Only cleans up data created in the current test session
 */
export async function cleanupTestData(
  supabase: SupabaseClient,
  testDataIds: { projects?: number[]; tasks?: number[]; comments?: number[] }
): Promise<void> {
  // Cleanup comments
  if (testDataIds.comments && testDataIds.comments.length > 0) {
    for (const commentId of testDataIds.comments) {
      await supabase.from('comments').delete().eq('id', commentId).catch(() => {
        // Ignore errors
      });
    }
  }

  // Cleanup tasks (comments cascade delete should handle)
  if (testDataIds.tasks && testDataIds.tasks.length > 0) {
    for (const taskId of testDataIds.tasks) {
      await supabase.from('tasks').delete().eq('id', taskId).catch(() => {
        // Ignore errors
      });
    }
  }

  // Cleanup projects (tasks cascade delete should handle)
  if (testDataIds.projects && testDataIds.projects.length > 0) {
    for (const projectId of testDataIds.projects) {
      await supabase.from('projects').delete().eq('id', projectId).catch(() => {
        // Ignore errors
      });
    }
  }
}

/**
 * Wait for element with custom timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to page safely
 */
export async function navigateToPage(page: Page, path: string): Promise<void> {
  const url = `${TEST_CONFIG.baseURL}${path}`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * Take screenshot for debugging
 */
export async function captureScreenshot(
  page: Page,
  name: string,
  folder: string = 'debug-screenshots'
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${folder}/debug-${name}-${timestamp}.png`;
  await page.screenshot({ path: filePath });
  return filePath;
}

/**
 * Generate unique test identifier
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique project name for testing
 */
export function generateProjectName(): string {
  return `Test Project ${generateTestId()}`;
}

/**
 * Generate unique task title for testing
 */
export function generateTaskTitle(): string {
  return `Test Task ${generateTestId()}`;
}

/**
 * Generate unique company name for testing
 */
export function generateCompanyName(): string {
  return `Test Company ${generateTestId()}`;
}

export default {
  TEST_CONFIG,
  getTestUser,
  getAllTestUsers,
  createSupabaseClient,
  loginUser,
  logoutUser,
  authenticateAsUser,
  getAuthenticatedClient,
  cleanupTestData,
  waitForElement,
  navigateToPage,
  captureScreenshot,
  generateTestId,
  generateProjectName,
  generateTaskTitle,
  generateCompanyName,
};
