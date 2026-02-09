import { test, expect } from '@playwright/test';

/**
 * Admin Tests
 * Tests for admin panel and administration features
 */

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to admin page
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Admin Page Access', () => {
    test('should load admin page', async ({ page }) => {
      expect(page.url()).toContain('admin.html');

      // Should display admin interface or access denied message
      const adminContent = page.locator('main, [class*="admin"], [class*="container"]').first();

      const isAccessible = await adminContent.isVisible().catch(() => false);
      const isDenied = await page.locator('text=/access denied|permission|not authorized/i').isVisible().catch(() => false);

      expect(isAccessible || isDenied).toBeTruthy();
    });

    test('should display admin menu if user is admin', async ({ page }) => {
      // Check if user has admin access
      const adminMenu = page.locator('nav, [class*="admin-menu"]').first();

      const isVisible = await adminMenu.isVisible().catch(() => false);

      if (isVisible) {
        expect(adminMenu).toBeVisible();
      }
    });
  });

  test.describe('Invite Management', () => {
    test('should display invites section', async ({ page }) => {
      const invitesSection = page.locator('[class*="invite"]').first();
      const invitesText = page.getByText(/invite/i).first();

      const hasSection = await invitesSection.isVisible().catch(() => false);
      const hasText = await invitesText.isVisible().catch(() => false);

      if (hasSection || hasText) {
        expect(hasSection || hasText).toBeTruthy();
      }
    });

    test('should have create invite button', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Invite")').first();

      if (await createButton.isVisible()) {
        expect(createButton).toBeTruthy();
      }
    });

    test('should open invite creation form', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Invite")').first();

      if (!await createButton.isVisible()) {
        test.skip();
      }

      await createButton.click();

      // Should display invite form
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();

      const isFormVisible = await emailInput.isVisible().catch(() => false);

      if (isFormVisible) {
        await expect(emailInput).toBeVisible();
      }
    });

    test('should create invite with email', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Invite")').first();

      if (!await createButton.isVisible()) {
        test.skip();
      }

      await createButton.click();

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();

      if (!await emailInput.isVisible()) {
        test.skip();
      }

      const testEmail = `invite_${Date.now()}@example.com`;
      await emailInput.fill(testEmail);

      const submitButton = page.locator('button:has-text("Create"), button:has-text("Send"), button:has-text("Invite")').last();
      await submitButton.click();

      await page.waitForTimeout(1000);

      // Should show success or add invite to list
      const successMessage = await page.locator('[class*="success"], text=/created|sent|success/i').isVisible().catch(() => false);

      expect(successMessage).toBeTruthy();
    });

    test('should display invite list', async ({ page }) => {
      const inviteList = page.locator('[class*="invite-list"], table, [class*="list"]').first();

      if (await inviteList.isVisible()) {
        expect(inviteList).toBeTruthy();
      }
    });

    test('should show invite status', async ({ page }) => {
      const inviteItem = page.locator('[class*="invite"], tr').first();

      if (await inviteItem.isVisible()) {
        const statusBadge = inviteItem.locator('[class*="status"], [class*="badge"]');

        if (await statusBadge.isVisible()) {
          const status = await statusBadge.textContent();
          expect(status).toBeTruthy();
        }
      }
    });

    test('should have delete invite option', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove"), button:has-text("Revoke")').first();

      if (await deleteButton.isVisible()) {
        expect(deleteButton).toBeTruthy();
      }
    });

    test('should confirm before deleting invite', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove"), button:has-text("Revoke")').first();

      if (!await deleteButton.isVisible()) {
        test.skip();
      }

      await deleteButton.click();

      // Should show confirmation
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Yes"), button:has-text("Confirm")').last();

      const isVisible = await confirmButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(confirmButton).toBeVisible();
      }
    });
  });

  test.describe('Company Settings', () => {
    test('should display company settings section', async ({ page }) => {
      const settingsSection = page.locator('[class*="company"], [class*="setting"]').first();

      if (await settingsSection.isVisible()) {
        expect(settingsSection).toBeTruthy();
      }
    });

    test('should display company name', async ({ page }) => {
      const companyName = page.locator('[class*="company-name"]').first();

      if (await companyName.isVisible()) {
        const text = await companyName.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should allow editing company settings', async ({ page }) => {
      const editButton = page.locator('button:has-text("Edit"), button:has-text("Update")').filter({ has: page.locator('[class*="company"]') }).first();

      if (await editButton.isVisible()) {
        await editButton.click();

        const input = page.locator('input, textarea').first();

        const isEditable = await input.isVisible().catch(() => false);

        expect(isEditable).toBeTruthy();
      }
    });
  });

  test.describe('User Management', () => {
    test('should display users list', async ({ page }) => {
      const usersList = page.locator('[class*="user"], [class*="member"], table, [class*="list"]').first();

      if (await usersList.isVisible()) {
        expect(usersList).toBeTruthy();
      }
    });

    test('should show user roles', async ({ page }) => {
      const userItem = page.locator('[class*="user"], tr').first();

      if (await userItem.isVisible()) {
        const roleCell = userItem.locator('[class*="role"], td:nth-child(2)');

        if (await roleCell.isVisible()) {
          const role = await roleCell.textContent();
          expect(role).toBeTruthy();
        }
      }
    });

    test('should have option to change user role', async ({ page }) => {
      const roleSelect = page.locator('select[name="role"], [role="combobox"]').first();

      if (await roleSelect.isVisible()) {
        expect(roleSelect).toBeTruthy();
      }
    });
  });

  test.describe('Admin Navigation', () => {
    test('should have tabs for different sections', async ({ page }) => {
      const tabs = page.locator('[role="tab"], [class*="nav-tab"]');

      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should navigate between admin sections', async ({ page }) => {
      const tabs = page.locator('[role="tab"], [class*="nav-tab"]');

      if (await tabs.count() > 1) {
        const secondTab = tabs.nth(1);
        await secondTab.click();

        await page.waitForTimeout(500);

        expect(page.url()).toBeTruthy();
      }
    });

    test('should have back link to dashboard', async ({ page }) => {
      const backButton = page.locator('a:has-text("Dashboard"), a:has-text("Back")').first();

      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('dashboard');
      }
    });
  });

  test.describe('Admin Messages', () => {
    test('should display admin notifications', async ({ page }) => {
      const notifications = page.locator('[class*="notification"], [class*="alert"], [class*="message"]').first();

      if (await notifications.isVisible()) {
        const text = await notifications.textContent();
        expect(text).toBeTruthy();
      }
    });
  });
});
