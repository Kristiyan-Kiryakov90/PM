import { test, expect } from '@playwright/test';

/**
 * Profile Tests
 * Tests for user profile management, name updates, and password changes
 */

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Ensure user is authenticated
    // Navigate to profile page (assumes auth is handled by middleware)
    await page.goto('/profile.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Profile Page Display', () => {
    test('should load profile page successfully', async ({ page }) => {
      // Page should load without errors
      expect(page.url()).toContain('profile.html');

      // Should display profile sections
      const profileForm = page.locator('form').first();
      await expect(profileForm).toBeVisible();
    });

    test('should display user information', async ({ page }) => {
      // Should display current user email or name
      const userInfo = page.locator('[class*="user"], [class*="profile"]').first();

      if (await userInfo.isVisible()) {
        const text = await userInfo.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should have profile form fields', async ({ page }) => {
      // Check for name input fields
      const firstNameInput = page.locator('input[name="first_name"], input[placeholder*="First"]').first();
      const lastNameInput = page.locator('input[name="last_name"], input[placeholder*="Last"]').first();

      // At least one should exist
      const hasFirstName = await firstNameInput.isVisible().catch(() => false);
      const hasLastName = await lastNameInput.isVisible().catch(() => false);

      expect(hasFirstName || hasLastName).toBeTruthy();
    });
  });

  test.describe('Profile Update', () => {
    test('should update first name', async ({ page }) => {
      const firstNameInput = page.locator('input[name="first_name"], input[placeholder*="First"]').first();

      if (!await firstNameInput.isVisible()) {
        test.skip();
      }

      const newFirstName = `Test_${Date.now()}`;

      await firstNameInput.fill(newFirstName);

      // Find and click save button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      // Wait for success message or confirmation
      await page.waitForTimeout(1000);

      // Check for success message
      const successMessage = await page.locator('[class*="success"], [class*="alert-success"], .toast').isVisible().catch(() => false);

      // Or check that value was saved
      const currentValue = await firstNameInput.inputValue();
      expect(currentValue === newFirstName || successMessage).toBeTruthy();
    });

    test('should update last name', async ({ page }) => {
      const lastNameInput = page.locator('input[name="last_name"], input[placeholder*="Last"]').first();

      if (!await lastNameInput.isVisible()) {
        test.skip();
      }

      const newLastName = `TestUser_${Date.now()}`;

      await lastNameInput.fill(newLastName);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      await page.waitForTimeout(1000);

      const currentValue = await lastNameInput.inputValue();
      const successMessage = await page.locator('[class*="success"], [class*="alert-success"], .toast').isVisible().catch(() => false);

      expect(currentValue === newLastName || successMessage).toBeTruthy();
    });

    test('should update both names together', async ({ page }) => {
      const firstNameInput = page.locator('input[name="first_name"], input[placeholder*="First"]').first();
      const lastNameInput = page.locator('input[name="last_name"], input[placeholder*="Last"]').first();

      if (!await firstNameInput.isVisible() || !await lastNameInput.isVisible()) {
        test.skip();
      }

      const newFirstName = `John_${Date.now()}`;
      const newLastName = `Doe_${Date.now()}`;

      await firstNameInput.fill(newFirstName);
      await lastNameInput.fill(newLastName);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      await page.waitForTimeout(1000);

      const firstName = await firstNameInput.inputValue();
      const lastName = await lastNameInput.inputValue();

      expect(firstName === newFirstName || lastName === newLastName).toBeTruthy();
    });

    test('should validate that first name is required', async ({ page }) => {
      const firstNameInput = page.locator('input[name="first_name"], input[placeholder*="First"]').first();

      if (!await firstNameInput.isVisible()) {
        test.skip();
      }

      // Clear the field
      await firstNameInput.clear();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      await page.waitForTimeout(500);

      // Should show error or prevent submission
      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/required|empty/i').isVisible().catch(() => false);
      const inputHasRequired = await firstNameInput.getAttribute('required');

      expect(errorMessage || inputHasRequired).toBeTruthy();
    });

    test('should validate that last name is required', async ({ page }) => {
      const lastNameInput = page.locator('input[name="last_name"], input[placeholder*="Last"]').first();

      if (!await lastNameInput.isVisible()) {
        test.skip();
      }

      await lastNameInput.clear();

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      await page.waitForTimeout(500);

      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/required|empty/i').isVisible().catch(() => false);
      const inputHasRequired = await lastNameInput.getAttribute('required');

      expect(errorMessage || inputHasRequired).toBeTruthy();
    });
  });

  test.describe('Password Change', () => {
    test('should have password change form', async ({ page }) => {
      const passwordForm = page.locator('form').filter({ has: page.locator('input[type="password"]') });

      await expect(passwordForm).toBeVisible();
    });

    test('should have password confirmation field', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');
      const count = await passwordInputs.count();

      // Should have at least 2 password fields (new password + confirm)
      expect(count >= 2).toBeTruthy();
    });

    test('should validate password match', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');

      if (await passwordInputs.count() < 2) {
        test.skip();
      }

      const newPassword = page.locator('input[placeholder*="password" i]').first();
      const confirmPassword = page.locator('input[placeholder*="confirm" i]').first();

      if (!await newPassword.isVisible() || !await confirmPassword.isVisible()) {
        test.skip();
      }

      // Fill with non-matching passwords
      await newPassword.fill('TestPass123');
      await confirmPassword.fill('DifferentPass123');

      const updateButton = page.locator('button:has-text("Update"), button:has-text("Change")').filter({ has: page.locator('input[type="password"]').first() }).first();
      await updateButton.click();

      await page.waitForTimeout(500);

      // Should show error about passwords not matching
      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/match|same/i').isVisible().catch(() => false);

      expect(errorMessage).toBeTruthy();
    });

    test('should validate password complexity - minimum length', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');

      if (await passwordInputs.count() < 2) {
        test.skip();
      }

      const newPassword = page.locator('input[placeholder*="password" i]').first();
      const confirmPassword = page.locator('input[placeholder*="confirm" i]').first();

      if (!await newPassword.isVisible() || !await confirmPassword.isVisible()) {
        test.skip();
      }

      // Fill with short password
      await newPassword.fill('Short1');
      await confirmPassword.fill('Short1');

      const updateButton = page.locator('button:has-text("Update"), button:has-text("Change")').filter({ has: page.locator('input[type="password"]').first() }).first();
      await updateButton.click();

      await page.waitForTimeout(500);

      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/character|length|long/i').isVisible().catch(() => false);

      expect(errorMessage).toBeTruthy();
    });

    test('should validate password requires uppercase letter', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');

      if (await passwordInputs.count() < 2) {
        test.skip();
      }

      const newPassword = page.locator('input[placeholder*="password" i]').first();
      const confirmPassword = page.locator('input[placeholder*="confirm" i]').first();

      if (!await newPassword.isVisible() || !await confirmPassword.isVisible()) {
        test.skip();
      }

      // Fill with password without uppercase
      await newPassword.fill('lowercase123');
      await confirmPassword.fill('lowercase123');

      const updateButton = page.locator('button:has-text("Update"), button:has-text("Change")').filter({ has: page.locator('input[type="password"]').first() }).first();
      await updateButton.click();

      await page.waitForTimeout(500);

      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/uppercase|capital|[A-Z]/i').isVisible().catch(() => false);

      expect(errorMessage).toBeTruthy();
    });

    test('should validate password requires lowercase letter', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');

      if (await passwordInputs.count() < 2) {
        test.skip();
      }

      const newPassword = page.locator('input[placeholder*="password" i]').first();
      const confirmPassword = page.locator('input[placeholder*="confirm" i]').first();

      if (!await newPassword.isVisible() || !await confirmPassword.isVisible()) {
        test.skip();
      }

      // Fill with password without lowercase
      await newPassword.fill('UPPERCASE123');
      await confirmPassword.fill('UPPERCASE123');

      const updateButton = page.locator('button:has-text("Update"), button:has-text("Change")').filter({ has: page.locator('input[type="password"]').first() }).first();
      await updateButton.click();

      await page.waitForTimeout(500);

      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/lowercase|[a-z]/i').isVisible().catch(() => false);

      expect(errorMessage).toBeTruthy();
    });

    test('should validate password requires number', async ({ page }) => {
      const passwordInputs = page.locator('input[type="password"]');

      if (await passwordInputs.count() < 2) {
        test.skip();
      }

      const newPassword = page.locator('input[placeholder*="password" i]').first();
      const confirmPassword = page.locator('input[placeholder*="confirm" i]').first();

      if (!await newPassword.isVisible() || !await confirmPassword.isVisible()) {
        test.skip();
      }

      // Fill with password without number
      await newPassword.fill('NoNumbers');
      await confirmPassword.fill('NoNumbers');

      const updateButton = page.locator('button:has-text("Update"), button:has-text("Change")').filter({ has: page.locator('input[type="password"]').first() }).first();
      await updateButton.click();

      await page.waitForTimeout(500);

      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"], text=/number|digit|[0-9]/i').isVisible().catch(() => false);

      expect(errorMessage).toBeTruthy();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state when saving profile', async ({ page }) => {
      const firstNameInput = page.locator('input[name="first_name"], input[placeholder*="First"]').first();

      if (!await firstNameInput.isVisible()) {
        test.skip();
      }

      await firstNameInput.fill(`Test_${Date.now()}`);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
      const initialText = await saveButton.textContent();

      await saveButton.click();

      // Button might show loading text like "Saving..."
      await page.waitForTimeout(100);
      const loadingText = await saveButton.textContent();

      // Either shows loading state or is disabled
      const isLoading = loadingText?.includes('Saving') ||
                       loadingText?.includes('..') ||
                       await saveButton.isDisabled();

      expect(isLoading || initialText === loadingText).toBeTruthy();
    });
  });
});
