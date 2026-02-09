# TaskFlow - Playwright E2E Tests

Comprehensive end-to-end test suite for the TaskFlow task and project management application using Playwright and TypeScript.

## 📋 Test Coverage

The test suite covers all major features of the TaskFlow application:

### Test Files

1. **auth.spec.ts** - Authentication Tests
   - Sign up flow
   - Sign in flow
   - Navigation authentication checks
   - Sign out functionality

2. **profile.spec.ts** - User Profile Tests
   - Profile display and loading
   - Name updates (first, last, both)
   - Password change with validation
   - Loading states and UI feedback

3. **projects.spec.ts** - Project Management Tests
   - Create projects
   - View project details
   - Edit projects
   - Delete projects
   - Project navigation
   - Status management

4. **tasks.spec.ts** - Task Management Tests
   - Create tasks
   - View task details
   - Edit tasks
   - Change task status
   - Drag and drop tasks
   - Task filtering and search
   - Delete tasks

5. **dashboard.spec.ts** - Dashboard Tests
   - Dashboard display and load
   - User information display
   - Statistics and metrics
   - Navigation links
   - Recent activity
   - Responsive design

6. **admin.spec.ts** - Admin Panel Tests
   - Admin access control
   - Invite management
   - User management
   - Company settings
   - Admin navigation

7. **landing.spec.ts** - Landing Page Tests
   - Landing page display
   - Navigation links
   - System admin bootstrap
   - Call to action buttons
   - Responsive design
   - Accessibility

8. **navigation.spec.ts** - Navigation Tests
   - Main navigation menu
   - Admin navigation
   - User menu
   - Mobile navigation
   - Page transitions
   - Link functionality

9. **ux.spec.ts** - User Experience Tests
   - Loading states
   - Error handling
   - Form validation
   - Notifications and feedback
   - Modal dialogs
   - Empty states
   - Keyboard navigation

## 🚀 Getting Started

### Installation

```bash
cd frontend
npm install
```

### Running Tests

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npm test auth.spec.ts
```

Run tests in UI mode (interactive):
```bash
npm run test:ui
```

Run tests in debug mode:
```bash
npm run test:debug
```

Run tests with headed browsers (visible):
```bash
npm run test:headed
```

Run tests for specific browser:
```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

View test report:
```bash
npm run test:report
```

## 🔧 Configuration

Test configuration is in `playwright.config.ts`:

```typescript
- baseURL: http://localhost:5173
- testDir: ./tests
- browsers: Chromium, Firefox, WebKit
- screenshots: Only on failure
- traces: On first retry
- retries: 0 in dev, 2 in CI
- workers: Parallel execution
```

## 📝 Test Structure

Each test file follows this structure:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code
  });

  test.describe('Specific Feature', () => {
    test('should do something', async ({ page }) => {
      // Test implementation
    });
  });
});
```

## ✅ Test Patterns

### Page Navigation
```typescript
await page.goto('/dashboard.html');
await page.waitForLoadState('networkidle');
```

### Element Interaction
```typescript
const button = page.locator('button:has-text("Create")');
await button.click();
```

### Form Filling
```typescript
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[type="password"]', 'password123');
```

### Waiting for Elements
```typescript
await expect(page.locator('text=/success/i')).toBeVisible();
```

### Error Handling
```typescript
const isVisible = await element.isVisible().catch(() => false);
```

## 🎯 Test Scenarios

### Authentication Tests
- ✅ User signup with valid credentials
- ✅ User signin with valid credentials
- ✅ Authentication required pages
- ✅ Signout flow

### Profile Tests
- ✅ Update first name
- ✅ Update last name
- ✅ Change password with validation
- ✅ Password complexity requirements
- ✅ Validation error handling

### Project Tests
- ✅ Create projects
- ✅ View project details
- ✅ Edit project properties
- ✅ Delete projects
- ✅ Project status management
- ✅ Task count display

### Task Tests
- ✅ Create tasks
- ✅ Edit tasks
- ✅ Change task status
- ✅ Drag and drop tasks
- ✅ Filter by project/status/priority
- ✅ Task search
- ✅ Delete tasks

### Dashboard Tests
- ✅ Display user welcome message
- ✅ Show statistics
- ✅ Navigation to features
- ✅ Recent activity display
- ✅ Responsive layout

### Admin Tests
- ✅ Access control
- ✅ Create invites
- ✅ Manage invites
- ✅ User management
- ✅ Company settings

### UX Tests
- ✅ Loading states
- ✅ Form validation
- ✅ Success notifications
- ✅ Error handling
- ✅ Modal dialogs
- ✅ Keyboard navigation
- ✅ Accessibility

## 🌐 Browser Compatibility

Tests run on:
- ✅ Chromium
- ✅ Firefox
- ✅ WebKit (Safari)

## 📊 Test Execution

### Local Development
```bash
# Start dev server
npm run dev

# In another terminal, run tests
npm test
```

### CI/CD Pipeline
```bash
# Tests run automatically with proper retries and reporting
npm test
```

## 🐛 Debugging Tests

### Debug Mode
```bash
npm run test:debug
```

### Headed Mode (see browser)
```bash
npm run test:headed
```

### UI Mode (interactive)
```bash
npm run test:ui
```

### Generate Trace
```bash
npm test -- --trace on
```

## 📸 Screenshots & Traces

When tests fail:
- Screenshots saved in `test-results/`
- Traces saved in `test-results/`
- HTML report generated

View traces:
```bash
npx playwright show-trace <trace-file>
```

## 🔐 Test Data

Tests use:
- Generated unique IDs (timestamps) for test data
- Environment variables for sensitive test credentials
- No hardcoded user passwords in tests

Setup test credentials:
```bash
export TEST_EMAIL="test@example.com"
export TEST_PASSWORD="TestPassword123!"
```

## ✨ Best Practices

1. **Use Page Objects** - Encapsulate selectors and interactions
2. **Wait Properly** - Use `waitForLoadState()` and explicit waits
3. **Handle Optionals** - Use `.catch(() => false)` for optional elements
4. **Unique Selectors** - Use `data-testid` when possible
5. **Skip Gracefully** - Use `test.skip()` for unavailable features
6. **Error Messages** - Include descriptive assertions
7. **Cleanup** - Use `beforeEach` and `afterEach` hooks

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Debugging](https://playwright.dev/docs/debug)
- [Playwright CI/CD](https://playwright.dev/docs/ci)

## 🚨 Troubleshooting

### Tests Timeout
- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Check network connectivity

### Elements Not Found
- Verify selectors match current HTML
- Use `--ui` mode to inspect
- Check for dynamic content loading

### Flaky Tests
- Add explicit waits
- Increase retry count
- Check for race conditions

## 🤝 Contributing

When adding new tests:
1. Follow existing patterns
2. Use descriptive test names
3. Add comments for complex logic
4. Test both happy and error paths
5. Update this README

## 📝 Test Maintenance

- Review tests when UI changes
- Update selectors as needed
- Add tests for new features
- Remove tests for removed features
- Keep tests independent

---

**Last Updated:** 2026-02-08
**Playwright Version:** 1.58.2+
