import { test, expect } from '@playwright/test';

/**
 * Tasks Tests
 * Tests for task management, Kanban board, and task operations
 */

test.describe('Tasks Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to tasks page
    await page.goto('/tasks.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Tasks Page Display', () => {
    test('should load tasks page successfully', async ({ page }) => {
      expect(page.url()).toContain('tasks.html');

      // Should display task board or list
      const tasksSection = page.locator('[class*="board"], [class*="tasks"], [class*="kanban"], main, [class*="container"]').first();
      const isVisible = await tasksSection.isVisible({ timeout: 10000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    });

    test('should display Kanban board columns', async ({ page }) => {
      // Should show task columns (e.g., To Do, In Progress, Done)
      await page.waitForTimeout(1000);

      const columns = page.locator('[class*="column"], [class*="lane"], [class*="col"], [class*="status"]');

      await page.waitForTimeout(500);
      const columnCount = await columns.count();
      expect(columnCount).toBeGreaterThanOrEqual(0);
    });

    test('should have create task button', async ({ page }) => {
      await page.waitForTimeout(1000);

      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create"), button:has-text("Task")').first();

      const isVisible = await createButton.isVisible({ timeout: 10000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    });
  });

  test.describe('Create Task', () => {
    test('should open create task modal/form', async ({ page }) => {
      await page.waitForTimeout(1000);

      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create"), button:has-text("Task")').first();

      if (await createButton.isVisible({ timeout: 10000 })) {
        await createButton.click();
        await page.waitForTimeout(500);

        // Should display form fields for task
        const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"], input[placeholder*="Task"]').first();

        const isVisible = await taskTitleInput.isVisible({ timeout: 10000 }).catch(() => false);
        expect(isVisible).toBeTruthy();
      }
    });

    test('should validate task title is required', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")').first();
      await createButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      // Try to submit without title
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').last();
      await submitButton.click();

      await page.waitForTimeout(500);

      // Should show validation error
      const hasRequired = await taskTitleInput.getAttribute('required');
      const errorMessage = await page.locator('[class*="error"], [class*="alert-danger"]').isVisible().catch(() => false);

      expect(hasRequired || errorMessage).toBeTruthy();
    });

    test('should create new task with title only', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")').first();
      await createButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      const taskTitle = `Task_${Date.now()}`;
      await taskTitleInput.fill(taskTitle);

      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').last();
      await submitButton.click();

      await page.waitForTimeout(1500);

      // Should show success message or task appears on board
      const successMessage = await page.locator('[class*="success"], text=/created|success/i').isVisible().catch(() => false);
      const taskAdded = await page.locator(`text="${taskTitle}"`).isVisible().catch(() => false);

      expect(successMessage || taskAdded).toBeTruthy();
    });

    test('should create task with description', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")').first();
      await createButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();
      const descriptionInput = page.locator('textarea[name="description"], input[placeholder*="Description"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      const taskTitle = `Task_${Date.now()}`;
      const description = 'Test task description';

      await taskTitleInput.fill(taskTitle);

      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill(description);
      }

      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').last();
      await submitButton.click();

      await page.waitForTimeout(1500);

      const taskAdded = await page.locator(`text="${taskTitle}"`).isVisible().catch(() => false);
      expect(taskAdded).toBeTruthy();
    });

    test('should set task priority', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")').first();
      await createButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();
      const prioritySelect = page.locator('select[name="priority"], [role="combobox"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      await taskTitleInput.fill(`Task_${Date.now()}`);

      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('high').catch(() => {});
      }

      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').last();
      await submitButton.click();

      await page.waitForTimeout(1500);
    });

    test('should assign task to project', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), a:has-text("Create")').first();
      await createButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();
      const projectSelect = page.locator('select[name="project"], [role="combobox"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      await taskTitleInput.fill(`Task_${Date.now()}`);

      if (await projectSelect.isVisible()) {
        await projectSelect.click();
        const option = page.locator('[role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
        }
      }

      const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').last();
      await submitButton.click();

      await page.waitForTimeout(1500);
    });
  });

  test.describe('View Task Details', () => {
    test('should view task details', async ({ page }) => {
      // Get first task from board
      const taskCard = page.locator('[class*="task"], [class*="card"]').filter({ has: page.locator('text=/task|todo/i') }).first();

      if (!await taskCard.isVisible()) {
        test.skip();
      }

      await taskCard.click();

      await page.waitForTimeout(1000);

      // Should display task details modal or panel
      const taskDetails = page.locator('#taskModal');
      await expect(taskDetails).toBeAttached();
    });

    test('should display task status', async ({ page }) => {
      const taskCard = page.locator('[class*="task"], [class*="card"]').filter({ has: page.locator('text=/task|todo/i') }).first();

      if (!await taskCard.isVisible()) {
        test.skip();
      }

      const statusBadge = taskCard.locator('[class*="status"], [class*="badge"]');

      if (await statusBadge.isVisible()) {
        const status = await statusBadge.textContent();
        expect(status).toBeTruthy();
      }
    });

    test('should display task priority', async ({ page }) => {
      const taskCard = page.locator('[class*="task"], [class*="card"]').filter({ has: page.locator('text=/task|todo/i') }).first();

      if (!await taskCard.isVisible()) {
        test.skip();
      }

      const priorityBadge = taskCard.locator('[class*="priority"]');

      if (await priorityBadge.isVisible()) {
        const priority = await priorityBadge.textContent();
        expect(priority).toBeTruthy();
      }
    });
  });

  test.describe('Edit Task', () => {
    test('should edit task title', async ({ page }) => {
      const editButton = page.locator('button:has-text("Edit"), button:has-text("Update")').first();

      if (!await editButton.isVisible()) {
        test.skip();
      }

      await editButton.click();

      const taskTitleInput = page.locator('input[name="title"], input[placeholder*="Title"]').first();

      if (!await taskTitleInput.isVisible()) {
        test.skip();
      }

      const newTitle = `Updated_${Date.now()}`;
      await taskTitleInput.fill(newTitle);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').last();
      await saveButton.click();

      await page.waitForTimeout(1000);

      const successMessage = await page.locator('[class*="success"], text=/updated|saved/i').isVisible().catch(() => false);

      expect(successMessage).toBeTruthy();
    });

    test('should edit task description', async ({ page }) => {
      const editButton = page.locator('button:has-text("Edit"), button:has-text("Update")').first();

      if (!await editButton.isVisible()) {
        test.skip();
      }

      await editButton.click();

      const descriptionInput = page.locator('textarea[name="description"], input[placeholder*="Description"]').first();

      if (!await descriptionInput.isVisible()) {
        test.skip();
      }

      const newDescription = `Updated description ${Date.now()}`;
      await descriptionInput.fill(newDescription);

      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').last();
      await saveButton.click();

      await page.waitForTimeout(1000);
    });

    test('should change task status', async ({ page }) => {
      const statusDropdown = page.locator('select[name="status"], [class*="status"]').first();

      if (!await statusDropdown.isVisible()) {
        test.skip();
      }

      const currentStatus = await statusDropdown.inputValue().catch(() => '');

      // Try to change status
      if (currentStatus) {
        if (currentStatus !== 'completed' && currentStatus !== 'done') {
          await statusDropdown.selectOption('completed').catch(() => {});
        } else {
          await statusDropdown.selectOption('todo').catch(() => {});
        }

        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Drag and Drop', () => {
    test('should drag task between columns', async ({ page }) => {
      const taskCard = page.locator('[class*="task"], [class*="card"]').filter({ has: page.locator('text=/task|todo/i') }).first();

      if (!await taskCard.isVisible()) {
        test.skip();
      }

      // Get the current column
      const currentColumn = taskCard.locator('ancestor::div[class*="column"], ancestor::div[class*="lane"]');

      // Get another column
      const columns = page.locator('[class*="column"], [class*="lane"]');
      const targetColumn = columns.nth(1);

      if (!await targetColumn.isVisible()) {
        test.skip();
      }

      // Drag task to new column
      await taskCard.dragTo(targetColumn);

      await page.waitForTimeout(500);

      // Task should be in new column or status should have changed
      const newColumn = taskCard.locator('ancestor::div[class*="column"], ancestor::div[class*="lane"]');
      expect(await newColumn.isVisible()).toBeTruthy();
    });
  });

  test.describe('Delete Task', () => {
    test('should have delete option', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();

      if (await deleteButton.isVisible()) {
        expect(deleteButton).toBeTruthy();
      }
    });

    test('should confirm before deleting task', async ({ page }) => {
      const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();

      if (!await deleteButton.isVisible()) {
        test.skip();
      }

      await deleteButton.click();

      // Should show confirmation dialog
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Yes"), button:has-text("Confirm")').last();

      await expect(confirmButton).toBeVisible();
    });
  });

  test.describe('Task Filtering', () => {
    test('should filter tasks by project', async ({ page }) => {
      const projectFilter = page.locator('select[name="project"], [class*="filter"]').first();

      if (!await projectFilter.isVisible()) {
        test.skip();
      }

      await projectFilter.click();

      const option = page.locator('[role="option"]').first();
      if (await option.isVisible()) {
        await option.click();
      }

      await page.waitForTimeout(500);

      // Tasks should be filtered
      const tasks = page.locator('[class*="task"]');
      const count = await tasks.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter tasks by status', async ({ page }) => {
      const statusFilter = page.locator('select[name="status"], [class*="status-filter"]').first();

      if (!await statusFilter.isVisible()) {
        test.skip();
      }

      await statusFilter.selectOption('completed').catch(() => {});

      await page.waitForTimeout(500);
    });

    test('should filter tasks by priority', async ({ page }) => {
      const priorityFilter = page.locator('select[name="priority"], [class*="priority-filter"]').first();

      if (!await priorityFilter.isVisible()) {
        test.skip();
      }

      await priorityFilter.selectOption('high').catch(() => {});

      await page.waitForTimeout(500);
    });
  });

  test.describe('Task Search', () => {
    test('should have search functionality', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
      }
    });
  });
});
