import { chromium, FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Global Setup
 * Runs once before all tests to set up authentication state
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  const email = process.env.TEST_EMAIL || 'playwright.test@taskflow.com';
  const password = process.env.TEST_PASSWORD || 'TestPassword123!';

  console.log('🔐 Logging in test user for session storage...');

  try {
    // Navigate to signin
    await page.goto(`${baseURL}/signin.html`);
    await page.waitForLoadState('networkidle');

    // Fill credentials
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard
    await page.waitForTimeout(3000);

    if (page.url().includes('dashboard')) {
      console.log('✅ Login successful, session stored');

      // Save authentication state
      await page.context().storageState({ path: 'tests/.auth/user.json' });
    } else {
      console.warn('⚠️  Login may have failed');
    }
  } catch (error) {
    console.error('❌ Global setup failed:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
