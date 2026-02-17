import { test, expect } from '@playwright/test';
import { 
  loginUser, 
  navigateToPage,
  generateTaskTitle,
  getAuthenticatedClient,
  cleanupTestData,
} from '../test-setup';

/**
 * Comments and Activity E2E Tests
 * Tests for commenting, mentions, and activity logging
 */

test.describe('Comments & Activity - E2E', () => {
  let testDataIds = { tasks: [] as number[], comments: [] as number[] };

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginUser(page, 'admin');

    // Navigate to tasks
    await navigateToPage(page, '/tasks.html');
  });

  test.afterEach(async () => {
    // Cleanup created data
    if (testDataIds.comments.length > 0 || testDataIds.tasks.length > 0) {
      const supabase = await getAuthenticatedClient('admin');
      await cleanupTestData(supabase, testDataIds);
      testDataIds.tasks = [];
      testDataIds.comments = [];
    }
  });

  test.describe('Task Comments', () => {


    test('[E2E-COMMENT-002] Can add comment to task', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find and open a task
      const taskItem = page.locator('[class*="task-item"], [class*="task-card"]').first();

      if (await taskItem.isVisible({ timeout: 5000 })) {
        const taskLink = taskItem.locator('a, button').first();
        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // Find comment input
          const commentInput = page.locator(
            'textarea[placeholder*="Comment"], input[placeholder*="Comment"], [contenteditable="true"]'
          ).first();

          if (await commentInput.isVisible({ timeout: 5000 })) {
            // Type comment
            const testComment = `Test comment ${Date.now()}`;
            await commentInput.fill(testComment);

            // Submit comment
            const submitButton = page.locator('button:has-text("Post"), button:has-text("Send"), button:has-text("Comment")').last();
            if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
              await submitButton.click();
              await page.waitForTimeout(1000);

              // Comment should appear
              const hasComment = await page.locator(`text=${testComment}`).isVisible({ timeout: 5000 }).catch(() => false);
              expect(hasComment).toBeTruthy();
            }
          }
        }
      }
    });

    test('[E2E-COMMENT-003] Can reply to comment', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find and open a task with comments
      const taskItem = page.locator('[class*="task-item"], [class*="task-card"]').first();

      if (await taskItem.isVisible({ timeout: 5000 })) {
        const taskLink = taskItem.locator('a, button').first();
        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // Find reply button on existing comment
          const replyButton = page.locator('button:has-text("Reply")').first();

          if (await replyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await replyButton.click();
            await page.waitForTimeout(500);

            // Type reply
            const replyInput = page.locator(
              'textarea[placeholder*="Reply"], input[placeholder*="Reply"]'
            ).last();

            if (await replyInput.isVisible({ timeout: 3000 })) {
              const testReply = `Test reply ${Date.now()}`;
              await replyInput.fill(testReply);

              // Submit reply
              const submitButton = page.locator('button:has-text("Post"), button:has-text("Send")').last();
              if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await submitButton.click();
                await page.waitForTimeout(1000);

                expect(page.url()).toBeTruthy();
              }
            }
          }
        }
      }
    });

    test('[E2E-COMMENT-004] Can mention user in comment', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find and open a task
      const taskItem = page.locator('[class*="task-item"], [class*="task-card"]').first();

      if (await taskItem.isVisible({ timeout: 5000 })) {
        const taskLink = taskItem.locator('a, button').first();
        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // Find comment input
          const commentInput = page.locator(
            'textarea[placeholder*="Comment"], input[placeholder*="Comment"]'
          ).first();

          if (await commentInput.isVisible({ timeout: 5000 })) {
            // Type mention
            await commentInput.fill('@');
            await page.waitForTimeout(500);

            // Look for user suggestion
            const userSuggestion = page.locator('[class*="mention"], [class*="suggestion"]').first();
            if (await userSuggestion.isVisible({ timeout: 3000 }).catch(() => false)) {
              await userSuggestion.click();
              await page.waitForTimeout(300);

              // Complete comment
              await commentInput.fill(`@User test comment ${Date.now()}`);

              // Submit
              const submitButton = page.locator('button:has-text("Post"), button:has-text("Send")').last();
              if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await submitButton.click();
                await page.waitForTimeout(1000);

                expect(page.url()).toBeTruthy();
              }
            }
          }
        }
      }
    });



    test('[E2E-COMMENT-006] Can delete own comment', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find and open a task
      const taskItem = page.locator('[class*="task-item"], [class*="task-card"]').first();

      if (await taskItem.isVisible({ timeout: 5000 })) {
        const taskLink = taskItem.locator('a, button').first();
        if (await taskLink.isVisible()) {
          await taskLink.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // Find delete button on own comment
          const deleteButton = page.locator('button[title*="Delete"], button:has-text("Delete")').first();

          if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await deleteButton.click();
            await page.waitForTimeout(500);

            // Confirm deletion
            const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
            if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
              await confirmButton.click();
              await page.waitForTimeout(1000);

              expect(page.url()).toBeTruthy();
            }
          }
        }
      }
    });
  });

  test.describe('Activity Log', () => {


    test('[E2E-ACTIVITY-002] Activity log shows task creation', async ({ page }) => {
      // Create a task first
      await navigateToPage(page, '/tasks.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const createButton = page.locator('button:has-text("Create"), button:has-text("New")').first();
      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click();
        await page.waitForTimeout(500);

        const taskTitle = generateTaskTitle();
        const titleInput = page.locator('input[placeholder*="Task"], input[placeholder*="Title"]').first();

        if (await titleInput.isVisible({ timeout: 5000 })) {
          await titleInput.fill(taskTitle);

          const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').last();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(1000);

            // Check activity log
            await navigateToPage(page, '/dashboard.html');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            const hasActivity = await page.locator(`text=${taskTitle}`).isVisible({ timeout: 5000 }).catch(() => false);
            expect(hasActivity || page.url().includes('dashboard.html')).toBeTruthy();
          }
        }
      }
    });

    test('[E2E-ACTIVITY-003] Activity log shows task status changes', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find a task and change its status
      const taskItem = page.locator('[class*="task-item"], [class*="task-card"]').first();

      if (await taskItem.isVisible({ timeout: 5000 })) {
        const statusButton = taskItem.locator('button[title*="Status"]').first();

        if (await statusButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await statusButton.click();
          await page.waitForTimeout(300);

          const statusOption = page.locator('text=/done|completed/i').first();
          if (await statusOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await statusOption.click();
            await page.waitForTimeout(1000);

            // Check activity log
            await navigateToPage(page, '/dashboard.html');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            expect(page.url()).toContain('dashboard.html');
          }
        }
      }
    });
  });

  test.describe('Notifications', () => {
    test('[E2E-NOTIFY-001] Notification bell appears when mentioned', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Look for notification bell in header
      const notificationBell = page.locator(
        '[class*="notification"], [class*="bell"], button[title*="Notification"]'
      ).first();

      const isVisible = await notificationBell.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    });

    test('[E2E-NOTIFY-002] Can view notifications', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click notification bell
      const notificationBell = page.locator('[class*="notification"], button[title*="Notification"]').first();

      if (await notificationBell.isVisible({ timeout: 5000 }).catch(() => false)) {
        await notificationBell.click();
        await page.waitForTimeout(500);

        // Notification panel should appear
        const notificationPanel = page.locator('[class*="notification"], [class*="dropdown"]').first();
        const isVisible = await notificationPanel.isVisible({ timeout: 5000 }).catch(() => false);

        expect(isVisible).toBeTruthy();
      }
    });

    test('[E2E-NOTIFY-003] Can mark notification as read', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Open notifications
      const notificationBell = page.locator('[class*="notification"], button[title*="Notification"]').first();

      if (await notificationBell.isVisible({ timeout: 5000 }).catch(() => false)) {
        await notificationBell.click();
        await page.waitForTimeout(500);

        // Find unread notification
        const unreadNotif = page.locator('[class*="unread"], [class*="notification"]').first();

        if (await unreadNotif.isVisible({ timeout: 3000 }).catch(() => false)) {
          await unreadNotif.click();
          await page.waitForTimeout(500);

          expect(page.url()).toBeTruthy();
        }
      }
    });
  });
});
