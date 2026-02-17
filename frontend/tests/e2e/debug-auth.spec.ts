import { test, expect } from '@playwright/test';
import { getTestUser, loginUser } from '../test-setup';

/**
 * Debug Authentication Test
 * Simple test to verify auth flow works
 */

test.describe('Debug - Authentication Flow', () => {
  test('[DEBUG-AUTH-001] Check if signin page loads', async ({ page }) => {
    await page.goto('http://localhost:5173/signin.html');
    await page.waitForLoadState('domcontentloaded');
    
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    
    console.log('✅ Signin page loads successfully');
  });

  test('[DEBUG-AUTH-002] Check if form accepts input', async ({ page }) => {
    await page.goto('http://localhost:5173/signin.html');
    await page.waitForLoadState('domcontentloaded');
    
    const testUser = getTestUser('admin');
    
    const emailInput = page.locator('#email');
    await emailInput.fill(testUser.email);
    
    const passwordInput = page.locator('#password');
    await passwordInput.fill(testUser.password);
    
    // Check values were set
    expect(await emailInput.inputValue()).toBe(testUser.email);
    expect(await passwordInput.inputValue()).toBe(testUser.password);
    
    console.log('✅ Form accepts input');
  });

  test('[DEBUG-AUTH-003] Attempt to login and log what happens', async ({ page }) => {
    // Set up console logging
    page.on('console', msg => {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
    });

    page.on('response', response => {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    });

    await page.goto('http://localhost:5173/signin.html');
    await page.waitForLoadState('domcontentloaded');
    
    const testUser = getTestUser('admin');
    
    // Fill and submit
    await page.locator('#email').fill(testUser.email);
    await page.locator('#password').fill(testUser.password);

    console.log(`Attempting login with: ${testUser.email}`);
    
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for any navigation or error
    try {
      const result = await Promise.race([
        page.waitForURL('**/dashboard.html', { timeout: 3000 }).then(() => 'navigated-to-dashboard'),
        page.waitForURL('**/admin.html', { timeout: 3000 }).then(() => 'navigated-to-admin'),
        page.locator('#signinError:not(.d-none)').waitFor({ timeout: 3000 }).then(() => 'error-shown'),
        new Promise(() => undefined) // Never resolves
      ]).catch(e => 'no-response');

      console.log(`Login result: ${result}`);
      console.log(`Current URL after auth attempt: ${page.url()}`);
    } catch (e) {
      console.log('Error during login:', e.message);
    }

    // Take screenshot
    await page.screenshot({ path: 'debug-auth-after-submit.png' });
  });
});
