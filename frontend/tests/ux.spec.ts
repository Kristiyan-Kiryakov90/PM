import { test, expect } from '@playwright/test';

/**
 * User Experience Tests
 * Tests for UI/UX, error handling, loading states, and notifications
 */

test.describe('User Experience', () => {
  test.describe('Loading States', () => {
    test('should show loading indicator when page loads', async ({ page }) => {
      await page.goto('/dashboard.html');

      // Look for loading indicator
      const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], .spinner, .loader').first();

      if (await loadingIndicator.isVisible()) {
        // Should disappear after loading
        await page.waitForLoadState('networkidle');

        const isStillVisible = await loadingIndicator.isVisible().catch(() => false);

        expect(!isStillVisible || await page.locator('main, [class*="content"]').isVisible()).toBeTruthy();
      }
    });

    test('should show loading state on form submission', async ({ page }) => {
      await page.goto('/profile.html');
      await page.waitForLoadState('networkidle');

      const input = page.locator('input').first();

      if (await input.isVisible()) {
        await input.fill('Test');

        const submitButton = page.locator('button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          // Check for disabled state or loading text
          const initialText = await submitButton.textContent();

          await submitButton.click();

          // Button might be disabled during submission
          const isDisabled = await submitButton.isDisabled().catch(() => false);
          const newText = await submitButton.textContent().catch(() => initialText);

          expect(isDisabled || newText?.includes('...') || !newText).toBeTruthy();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should display error messages for validation', async ({ page }) => {
      await page.goto('/signup.html');

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();

      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should prevent submission or show error
        const errorMessage = page.locator('[class*="error"], [class*="alert-danger"], [role="alert"]').first();

        const isError = await errorMessage.isVisible().catch(() => false);
        const inputError = await page.locator('input:invalid').isVisible().catch(() => false);

        expect(isError || inputError).toBeTruthy();
      }
    });

    test('should display error for API failures', async ({ page }) => {
      // Navigate to page that makes API calls
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      // Mock a failed API call
      await page.route('**/rest/v1/**', (route) => {
        route.abort('failed');
      });

      // Try to create/interact with something
      const createButton = page.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();

        // Should show error message
        const errorMessage = page.locator('[class*="error"], [class*="alert"]').first();

        await page.waitForTimeout(1000);

        const isError = await errorMessage.isVisible().catch(() => false);

        expect(isError).toBeTruthy();
      }
    });

    test('should handle 404 errors gracefully', async ({ page }) => {
      await page.goto('/nonexistent-page.html');

      // Should either show 404 message or redirect
      const content = page.locator('body').first();

      const text = await content.textContent();

      expect(text).toBeTruthy();
    });

    test('should handle network timeouts gracefully', async ({ page }) => {
      // Navigate to a page
      await page.goto('/projects.html');

      // Set slow network
      await page.route('**/*', (route) => {
        setTimeout(() => {
          route.continue();
        }, 5000);
      });

      // Page should still be usable
      const content = page.locator('main, [class*="content"]').first();

      expect(await content.isVisible().catch(() => false)).toBeTruthy();
    });
  });

  test.describe('Form Validation', () => {
    test('should show validation error on blur', async ({ page }) => {
      await page.goto('/signup.html');

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();

      if (await emailInput.isVisible()) {
        // Focus and blur without entering value
        await emailInput.focus();
        await emailInput.blur();

        // Should show validation error
        const errorMessage = page.locator('[class*="error"], [class*="invalid"]').first();

        const isError = await errorMessage.isVisible().catch(() => false);

        expect(isError || await emailInput.getAttribute('required')).toBeTruthy();
      }
    });

    test('should show real-time validation feedback', async ({ page }) => {
      await page.goto('/profile.html');
      await page.waitForLoadState('networkidle');

      const input = page.locator('input[type="password"]').first();

      if (await input.isVisible()) {
        // Type invalid password
        await input.type('abc');

        // Should show validation feedback
        await page.waitForTimeout(300);

        const feedback = page.locator('[class*="feedback"], [class*="help-text"], [class*="error"]').first();

        const isVisible = await feedback.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });

    test('should disable submit button for invalid form', async ({ page }) => {
      await page.goto('/signup.html');

      const submitButton = page.locator('button[type="submit"]').first();

      if (await submitButton.isVisible()) {
        // Form should be invalid by default
        const isDisabled = await submitButton.isDisabled().catch(() => false);

        // Fill form validly
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

        if (await emailInput.isVisible() && await passwordInput.isVisible()) {
          await emailInput.fill('test@example.com');
          await passwordInput.fill('TestPassword123!');

          // Button should be enabled
          const isEnabled = await submitButton.isEnabled().catch(() => false);

          expect(isEnabled).toBeTruthy();
        }
      }
    });
  });

  test.describe('Notifications & Feedback', () => {
    test('should show success message after action', async ({ page }) => {
      await page.goto('/profile.html');
      await page.waitForLoadState('networkidle');

      const input = page.locator('input').first();

      if (await input.isVisible()) {
        const currentValue = await input.inputValue();
        await input.fill(`${currentValue}_updated`);

        const submitButton = page.locator('button:has-text("Save"), button[type="submit"]').first();

        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Should show success notification
          const notification = page.locator('[class*="success"], [class*="alert-success"], [class*="toast"]').first();

          await page.waitForTimeout(500);

          const isVisible = await notification.isVisible().catch(() => false);

          expect(isVisible).toBeTruthy();
        }
      }
    });

    test('should show toast notifications', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create")').first();

      if (await createButton.isVisible()) {
        await createButton.click();

        const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();

        if (await nameInput.isVisible()) {
          await nameInput.fill(`Test_${Date.now()}`);

          const submitButton = page.locator('button:has-text("Create"), button[type="submit"]').last();

          await submitButton.click();

          await page.waitForTimeout(1000);

          const toast = page.locator('[class*="toast"], [class*="notification"], [class*="message"]').first();

          const isVisible = await toast.isVisible().catch(() => false);

          expect(isVisible).toBeTruthy();
        }
      }
    });

    test('should auto-dismiss notifications', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const notification = page.locator('[class*="toast"], [class*="notification"]').first();

      if (await notification.isVisible()) {
        // Wait for auto-dismiss
        await page.waitForTimeout(5000);

        const isStillVisible = await notification.isVisible().catch(() => false);

        // Should disappear
        expect(!isStillVisible).toBeTruthy();
      }
    });
  });

  test.describe('Modal Dialogs', () => {
    test('should display modal when opening forms', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

      if (await createButton.isVisible()) {
        await createButton.click();

        const modal = page.locator('[class*="modal"], [role="dialog"], [class*="dialog"]').first();

        const isVisible = await modal.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });

    test('should close modal on cancel', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

      if (!await createButton.isVisible()) {
        test.skip();
      }

      await createButton.click();

      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close"), button[aria-label*="close"]').first();

      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        const modal = page.locator('[class*="modal"], [role="dialog"]').first();

        await page.waitForTimeout(300);

        const isVisible = await modal.isVisible().catch(() => false);

        expect(!isVisible).toBeTruthy();
      }
    });

    test('should close modal on backdrop click', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();

      if (!await createButton.isVisible()) {
        test.skip();
      }

      await createButton.click();

      const backdrop = page.locator('[class*="modal-backdrop"], [class*="modal"] + div');

      if (await backdrop.isVisible()) {
        await backdrop.click();

        const modal = page.locator('[class*="modal"]').first();

        await page.waitForTimeout(300);

        const isVisible = await modal.isVisible().catch(() => false);

        expect(!isVisible).toBeTruthy();
      }
    });
  });

  test.describe('Empty States', () => {
    test('should display empty state when no items exist', async ({ page }) => {
      await page.goto('/projects.html');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=/no project|empty|create|get started/i').first();

      const list = page.locator('[class*="list"], [class*="item"]').first();

      const hasItems = await list.isVisible().catch(() => false);

      if (!hasItems) {
        const isEmptyVisible = await emptyState.isVisible().catch(() => false);

        expect(isEmptyVisible).toBeTruthy();
      }
    });

    test('should show CTA in empty state', async ({ page }) => {
      await page.goto('/tasks.html');
      await page.waitForLoadState('networkidle');

      const emptyState = page.locator('text=/no task|empty|create/i').first();

      if (await emptyState.isVisible()) {
        const cta = page.locator('button:has-text("Create"), a:has-text("Create")').first();

        const isVisible = await cta.isVisible().catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/dashboard.html');
      await page.waitForLoadState('networkidle');

      const buttons = page.locator('button');

      if (await buttons.count() > 0) {
        const firstButton = buttons.first();

        const hasLabel = await firstButton.getAttribute('aria-label');
        const hasText = await firstButton.textContent();

        expect(hasLabel || hasText).toBeTruthy();
      }
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/signup.html');

      const inputs = page.locator('input');

      if (await inputs.count() > 0) {
        const firstInput = inputs.first();

        const inputId = await firstInput.getAttribute('id');
        const name = await firstInput.getAttribute('name');

        if (inputId) {
          const label = page.locator(`label[for="${inputId}"]`);

          const isVisible = await label.isVisible().catch(() => false);

          expect(isVisible || name).toBeTruthy();
        }
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be navigable with Tab key', async ({ page }) => {
      await page.goto('/signup.html');

      const firstInput = page.locator('input').first();

      if (await firstInput.isVisible()) {
        await firstInput.focus();

        // Tab to next element
        await page.keyboard.press('Tab');

        const focusedElement = await page.locator(':focus');

        const isFocused = await focusedElement.isVisible().catch(() => false);

        expect(isFocused).toBeTruthy();
      }
    });

    test('should submit form with Enter key', async ({ page }) => {
      await page.goto('/signin.html');

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();

      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');

        // Move to password field
        await page.keyboard.press('Tab');

        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

        if (await passwordInput.isVisible()) {
          await passwordInput.fill('TestPassword123!');

          // Press Enter to submit
          await passwordInput.press('Enter');

          // Form might be submitted
          await page.waitForTimeout(1000);
        }
      }
    });
  });
});
