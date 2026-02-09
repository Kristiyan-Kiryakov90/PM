import { chromium, type Browser, type Page } from 'playwright';

/**
 * Test User Setup Script
 * Creates a test user account for running automated tests
 */

const TEST_USER = {
  email: 'playwright.test@taskflow.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
};

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

// Run the setup
createTestUser().catch(console.error);
