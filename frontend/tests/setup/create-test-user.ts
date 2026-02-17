import { chromium, type Browser, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.test
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

/**
 * Test User Setup Script
 * Creates 3 test users with different roles (sys_admin, admin, user) for comprehensive testing
 * This ensures we test all functionality with minimal database pollution
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Use environment variables for test credentials
const TEST_USER = {
  email: process.env.TEST_EMAIL || process.env.TEST_ADMIN_EMAIL || 'playwright.test@taskflow.com',
  password: process.env.TEST_PASSWORD || process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!',
  firstName: process.env.TEST_FIRST_NAME || 'Test',
  lastName: process.env.TEST_LAST_NAME || 'User',
};

const TEST_USERS = [
  {
    email: process.env.TEST_ADMIN_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
    password: process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
    firstName: process.env.TEST_ADMIN_FIRST_NAME || 'Test',
    lastName: process.env.TEST_ADMIN_LAST_NAME || 'Admin',
    role: 'admin',
    company: 'Test Company Admin'
  },
  {
    email: process.env.TEST_USER_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
    password: process.env.TEST_USER_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
    firstName: process.env.TEST_USER_FIRST_NAME || 'Test',
    lastName: process.env.TEST_USER_LAST_NAME || 'User',
    role: 'user',
    company: 'Test Company User'
  },
  {
    email: process.env.TEST_SYSADMIN_EMAIL || process.env.TEST_EMAIL || 'playwright.test@taskflow.com',
    password: process.env.TEST_SYSADMIN_PASSWORD || process.env.TEST_PASSWORD || 'TestPassword123!',
    firstName: process.env.TEST_SYSADMIN_FIRST_NAME || 'Test',
    lastName: process.env.TEST_SYSADMIN_LAST_NAME || 'Admin',
    role: 'sys_admin',
    company: 'System Admin Company'
  }
];

async function createTestUser() {
  console.log('🚀 Starting test user setup...\n');

  const browser: Browser = await chromium.launch({ headless: false });
  const page: Page = await browser.newPage();

  try {
    // Navigate to signup page
    console.log('📄 Navigating to signup page...');
    await page.goto('http://localhost:5173/signup.html');
    await page.waitForLoadState('networkidle');

    // Check if we're already logged in (redirect to dashboard)
    if (page.url().includes('dashboard')) {
      console.log('✅ Already logged in, signing out first...');
      await page.goto('http://localhost:5173/index.html');
      await page.waitForTimeout(1000);

      const signoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout")').first();
      if (await signoutBtn.isVisible().catch(() => false)) {
        await signoutBtn.click();
        await page.waitForTimeout(1000);
      }

      await page.goto('http://localhost:5173/signup.html');
      await page.waitForLoadState('networkidle');
    }

    console.log('📝 Filling signup form...');

    // Find and fill form fields by ID (matching signup.html)
    const firstNameInput = page.locator('#firstName');
    const lastNameInput = page.locator('#lastName');
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const confirmPasswordInput = page.locator('#confirmPassword');

    // Fill all required fields
    await firstNameInput.fill(TEST_USER.firstName);
    console.log(`   ✓ First Name: ${TEST_USER.firstName}`);

    await lastNameInput.fill(TEST_USER.lastName);
    console.log(`   ✓ Last Name: ${TEST_USER.lastName}`);

    await emailInput.fill(TEST_USER.email);
    console.log(`   ✓ Email: ${TEST_USER.email}`);

    await passwordInput.fill(TEST_USER.password);
    console.log(`   ✓ Password: ${TEST_USER.password}`);

    await confirmPasswordInput.fill(TEST_USER.password);
    console.log(`   ✓ Confirm Password: ${TEST_USER.password}`);

    // Submit form
    console.log('\n📤 Submitting signup form...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up")').first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      console.log('   ✓ Form submitted');
    }

    // Wait for navigation or error
    await page.waitForTimeout(3000);

    // Check if signup was successful
    const currentUrl = page.url();
    console.log(`\n🔗 Current URL: ${currentUrl}`);

    if (currentUrl.includes('dashboard') || currentUrl.includes('signin')) {
      console.log('\n✅ SUCCESS! Test user created successfully!');
      console.log('\n📋 Test User Credentials:');
      console.log(`   Email:    ${TEST_USER.email}`);
      console.log(`   Password: ${TEST_USER.password}`);
      console.log('\n💡 Add these to your .env file:');
      console.log(`   TEST_EMAIL=${TEST_USER.email}`);
      console.log(`   TEST_PASSWORD=${TEST_USER.password}`);

      // If redirected to signin, try logging in
      if (currentUrl.includes('signin')) {
        console.log('\n🔐 Attempting to log in...');
        await performLogin(page, TEST_USER.email, TEST_USER.password);
      }

      // Take a screenshot
      await page.screenshot({ path: 'test-user-created.png' });
      console.log('\n📸 Screenshot saved: test-user-created.png');
    } else {
      console.log('\n⚠️  Signup may have failed or user already exists');
      console.log('   Check if email is already registered');

      // Try logging in instead
      console.log('\n🔐 Attempting to log in with existing credentials...');
      await page.goto('http://localhost:5173/signin.html');
      await page.waitForLoadState('networkidle');
      await performLogin(page, TEST_USER.email, TEST_USER.password);
    }

    // Keep browser open for inspection
    console.log('\n⏸️  Browser will stay open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ Error creating test user:', error);
    await page.screenshot({ path: 'test-user-error.png' });
    console.log('📸 Error screenshot saved: test-user-error.png');
  } finally {
    await browser.close();
    console.log('\n👋 Done!\n');
  }
}

async function performLogin(page: Page, email: string, password: string) {
  const emailInput = page.locator('#email');
  const passwordInput = page.locator('#password');
  const submitButton = page.locator('button[type="submit"]').first();

  await emailInput.fill(email);
  console.log(`   ✓ Email: ${email}`);

  await passwordInput.fill(password);
  console.log(`   ✓ Password: ${password}`);

  await submitButton.click();
  console.log('   ✓ Submitted');

  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  if (currentUrl.includes('dashboard')) {
    console.log('   ✅ Login successful!');
  } else {
    console.log(`   ⚠️  Current URL: ${currentUrl}`);
    // Check for error message
    const errorDiv = page.locator('#signinError, .alert-danger').first();
    if (await errorDiv.isVisible().catch(() => false)) {
      const errorText = await errorDiv.textContent();
      console.log(`   ❌ Error: ${errorText}`);
    }
  }
}

/**
 * Create test users via Supabase API
 * More efficient than using the UI for setup
 */
async function createTestUsersViaAPI() {
  console.log('🚀 Creating test users via Supabase API...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const createdUsers: any[] = [];

  for (const testUser of TEST_USERS) {
    try {
      console.log(`📝 Creating user: ${testUser.email} (${testUser.role})`);

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('auth.users')
        .select('id')
        .eq('email', testUser.email)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        console.log(`   ⚠️  User already exists`);
        createdUsers.push({ email: testUser.email, role: testUser.role, status: 'exists' });
        continue;
      }

      // Sign up user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            first_name: testUser.firstName,
            last_name: testUser.lastName,
            role: testUser.role,
            company_name: testUser.company
          }
        }
      });

      if (signUpError) {
        console.log(`   ❌ SignUp failed: ${signUpError.message}`);
        continue;
      }

      if (signUpData.user) {
        console.log(`   ✓ User created: ${signUpData.user.id}`);
        createdUsers.push({
          id: signUpData.user.id,
          email: testUser.email,
          role: testUser.role,
          status: 'created'
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
  }

  return createdUsers;
}

/**
 * Export test user data for use in tests
 */
export { TEST_USER, TEST_USERS };

/**
 * Export function to get test credentials
 */
export function getTestCredentials(role: 'admin' | 'user' | 'sys_admin' = 'admin') {
  const user = TEST_USERS.find(u => u.role === role);
  if (!user) {
    console.warn(`No test user found for role: ${role}, defaulting to first user`);
    return TEST_USERS[0];
  }
  return user;
}

// Run the setup when this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--api')) {
    createTestUsersViaAPI().then(users => {
      console.log('\n✅ Test users created:\n');
      users.forEach(u => {
        console.log(`  ${u.email} (${u.role}) - ${u.status}`);
      });
    }).catch(console.error);
  } else {
    createTestUser().catch(console.error);
  }
}
