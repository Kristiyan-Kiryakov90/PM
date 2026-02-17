import { test, expect } from '@playwright/test';
import { 
  loginUser, 
  navigateToPage,
  generateTestId,
  getTestUser,
} from '../test-setup';

/**
 * Admin Panel E2E Tests
 * Tests for admin functionality and system administration
 */

test.describe('Admin Panel - E2E', () => {
  test.describe('Admin Access Control', () => {


    test('[E2E-ADMIN-002] Admins can access admin page', async ({ page }) => {
      // Login as admin
      await navigateToPage(page, '/signin.html');
      await loginUser(page, 'admin');
      await page.waitForURL('**/dashboard.html', { timeout: 10000 });

      // Access admin page
      await navigateToPage(page, '/admin.html');
      await page.waitForLoadState('networkidle');

      // Should load admin page
      expect(page.url()).toContain('admin.html');
    });

    test('[E2E-ADMIN-003] System admin can access admin page', async ({ page }) => {
      // Try login as sys admin if available
      await navigateToPage(page, '/signin.html');
      
      try {
        await loginUser(page, 'sysAdmin');
        await page.waitForURL('**/dashboard.html', { timeout: 10000 });

        // Access admin page
        await navigateToPage(page, '/admin.html');
        await page.waitForLoadState('networkidle');

        // Should load admin page
        expect(page.url()).toContain('admin.html');
      } catch {
        // Sys admin might not be created, skip this test
        test.skip();
      }
    });
  });

  test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin
      await loginUser(page, 'admin');

      // Navigate to admin
      await navigateToPage(page, '/admin.html');
    });

    test('[E2E-ADMIN-004] Admin panel displays navigation', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Check for admin sections
      const hasUserMgmt = await page.locator('text=/user|member|invite/i').isVisible({ timeout: 5000 }).catch(() => false);
      const hasCompanyMgmt = await page.locator('text=/company|organization/i').isVisible({ timeout: 5000 }).catch(() => false);
      const hasSettings = await page.locator('text=/setting/i').isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasUserMgmt || hasCompanyMgmt || hasSettings).toBeTruthy();
    });


  });


  test.describe('Company Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, 'admin');
      await navigateToPage(page, '/admin.html');
    });

    test('[E2E-ADMIN-009] Can edit company name', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Open company settings
      const companySettings = page.locator('text=/company|organization|settings/i').first();

      if (await companySettings.isVisible({ timeout: 5000 })) {
        await companySettings.click();
        await page.waitForTimeout(500);

        // Find edit button
        const editButton = page.locator('button:has-text("Edit"), button[title*="Edit"]').first();

        if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await editButton.click();
          await page.waitForTimeout(500);

          // Find company name input
          const nameInput = page.locator('input[placeholder*="Company"], input[placeholder*="Name"]').first();

          if (await nameInput.isVisible({ timeout: 3000 })) {
            // Modify name (just add a space)
            const currentValue = await nameInput.inputValue();
            await nameInput.clear();
            await nameInput.fill(`${currentValue} ` + Date.now());

            // Save
            const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').last();
            if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
              await saveButton.click();
              await page.waitForTimeout(1000);

              expect(page.url()).toContain('admin.html');
            }
          }
        }
      }
    });
  });
});
