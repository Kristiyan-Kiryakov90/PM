import { Page, Locator } from '@playwright/test';

/**
 * Test Helpers
 * Utility functions for common test operations
 */

/**
 * Generate a unique ID using current timestamp
 */
export function generateUniqueId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}`;
}

/**
 * Wait for element to be visible with timeout
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<Locator> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  return element;
}

/**
 * Fill form field safely
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const field = page.locator(selector);
  if (await field.isVisible()) {
    await field.fill(value);
  }
}

/**
 * Click button safely (handles visibility and waiting)
 */
export async function clickButton(
  page: Page,
  selector: string
): Promise<void> {
  const button = page.locator(selector);
  if (await button.isVisible()) {
    await button.click();
  }
}

/**
 * Check if element is visible
 */
export async function isElementVisible(
  page: Page,
  selector: string
): Promise<boolean> {
  return await page.locator(selector).isVisible().catch(() => false);
}

/**
 * Get element text content
 */
export async function getElementText(
  page: Page,
  selector: string
): Promise<string> {
  return await page.locator(selector).textContent().catch(() => '');
}

/**
 * Get input value
 */
export async function getInputValue(
  page: Page,
  selector: string
): Promise<string> {
  return await page.locator(selector).inputValue().catch(() => '');
}

/**
 * Check if error message is displayed
 */
export async function hasErrorMessage(page: Page): Promise<boolean> {
  const errorSelectors = [
    '[class*="error"]',
    '[class*="alert-danger"]',
    '[role="alert"]',
    'text=/error|invalid|failed/i'
  ];

  for (const selector of errorSelectors) {
    if (await isElementVisible(page, selector)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if success message is displayed
 */
export async function hasSuccessMessage(page: Page): Promise<boolean> {
  const successSelectors = [
    '[class*="success"]',
    '[class*="alert-success"]',
    'text=/success|created|updated|saved/i'
  ];

  for (const selector of successSelectors) {
    if (await isElementVisible(page, selector)) {
      return true;
    }
  }

  return false;
}

/**
 * Submit form by clicking button
 */
export async function submitForm(
  page: Page,
  buttonSelector: string = 'button[type="submit"]'
): Promise<void> {
  await clickButton(page, buttonSelector);
  await page.waitForTimeout(500);
}

/**
 * Create a unique test email
 */
export function generateTestEmail(): string {
  return `test_${Date.now()}@example.com`;
}

/**
 * Create a valid test password
 */
export function generateTestPassword(): string {
  return `TestPassword${Date.now().toString().slice(-3)}!`;
}

/**
 * Navigate to page and wait for load
 */
export async function navigateToPage(
  page: Page,
  url: string
): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * Check if user is authenticated (redirects indicate auth)
 */
export async function isUserAuthenticated(page: Page): Promise<boolean> {
  // Try to access a protected page
  const currentUrl = page.url();
  return !currentUrl.includes('signin') && !currentUrl.includes('signup') && !currentUrl.includes('index');
}

/**
 * Get all visible items from a list
 */
export async function getListItems(
  page: Page,
  selector: string
): Promise<string[]> {
  const items = page.locator(selector);
  const count = await items.count();

  const itemTexts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).textContent().catch(() => '');
    if (text) {
      itemTexts.push(text.trim());
    }
  }

  return itemTexts;
}

/**
 * Check if modal/dialog is open
 */
export async function isModalOpen(page: Page): Promise<boolean> {
  const modalSelectors = [
    '[class*="modal"]',
    '[role="dialog"]',
    '[class*="dialog"]'
  ];

  for (const selector of modalSelectors) {
    if (await isElementVisible(page, selector)) {
      return true;
    }
  }

  return false;
}

/**
 * Close modal/dialog
 */
export async function closeModal(page: Page): Promise<void> {
  const closeButtons = [
    'button:has-text("Cancel")',
    'button:has-text("Close")',
    'button[aria-label*="close"]',
    '[class*="btn-close"]'
  ];

  for (const selector of closeButtons) {
    if (await isElementVisible(page, selector)) {
      await clickButton(page, selector);
      await page.waitForTimeout(300);
      return;
    }
  }
}

/**
 * Wait for notification/toast to appear and disappear
 */
export async function waitForNotification(page: Page, timeout: number = 5000): Promise<void> {
  const notification = page.locator('[class*="toast"], [class*="notification"], [class*="alert"]').first();

  try {
    await notification.waitFor({ state: 'visible', timeout: 1000 });
    // Wait for it to disappear
    await notification.waitFor({ state: 'hidden', timeout });
  } catch {
    // Notification might not have appeared
  }
}

/**
 * Clear all localStorage and sessionStorage
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get element count
 */
export async function getElementCount(
  page: Page,
  selector: string
): Promise<number> {
  return await page.locator(selector).count();
}

/**
 * Scroll to element
 */
export async function scrollToElement(
  page: Page,
  selector: string
): Promise<void> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
}

/**
 * Set viewport size for responsive testing
 */
export async function setViewportSize(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
}

/**
 * Viewport presets
 */
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  mobile_landscape: { width: 667, height: 375 },
  tablet_landscape: { width: 1024, height: 768 }
};

/**
 * Test data generators
 */
export const generateTestData = {
  projectName: () => `Project_${generateUniqueId()}`,
  taskTitle: () => `Task_${generateUniqueId()}`,
  userName: () => `User_${generateUniqueId()}`,
  companyName: () => `Company_${generateUniqueId()}`
};

/**
 * Common selectors
 */
export const SELECTORS = {
  // Forms
  submitButton: 'button[type="submit"]',
  cancelButton: 'button:has-text("Cancel")',

  // Messages
  errorMessage: '[class*="error"], [class*="alert-danger"]',
  successMessage: '[class*="success"], [class*="alert-success"]',
  notification: '[class*="toast"], [class*="notification"]',

  // Navigation
  signoutButton: 'button:has-text("Sign Out"), button:has-text("Logout")',
  profileLink: 'a:has-text("Profile")',

  // Modals
  modal: '[class*="modal"]',
  modalBackdrop: '[class*="modal-backdrop"]',

  // Tables
  tableRow: 'tr',
  tableCell: 'td'
};

/**
 * Common test data
 */
export const TEST_DATA = {
  validEmail: 'test@example.com',
  validPassword: 'TestPassword123!',
  invalidEmail: 'invalid-email',
  weakPassword: 'weak',
  mismatchPassword: 'MismatchPass123!Different123!'
};

export default {
  generateUniqueId,
  waitForElement,
  fillField,
  clickButton,
  isElementVisible,
  getElementText,
  getInputValue,
  hasErrorMessage,
  hasSuccessMessage,
  submitForm,
  generateTestEmail,
  generateTestPassword,
  navigateToPage,
  isUserAuthenticated,
  getListItems,
  isModalOpen,
  closeModal,
  waitForNotification,
  clearStorage,
  getElementCount,
  scrollToElement,
  setViewportSize,
  VIEWPORTS,
  generateTestData,
  SELECTORS,
  TEST_DATA
};
