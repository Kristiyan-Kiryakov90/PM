# TaskFlow Testing Guide

## 🚀 Quick Start

```bash
cd frontend

# Run all tests
npm test

# Run with interactive UI
npm run test:ui

# Run specific browser
npm run test:chromium
```

## 🔐 Test User

Already created and authenticated:
```
Email:    playwright.test@taskflow.com
Password: TestPassword123!
```

## ✅ Current Status

- **283 passing tests** (82% pass rate)
- **60 failing tests** (mostly modal timing issues)
- **Execution time:** 4.7 minutes

## 📊 Test Coverage

All features tested:
- ✅ Authentication (signup, signin, signout)
- ✅ Dashboard (stats, navigation)
- ✅ Projects (CRUD operations)
- ✅ Tasks (Kanban board, CRUD)
- ✅ Profile (name updates, password change)
- ✅ Admin (invites, users, company)
- ✅ Navigation (menus, responsive)
- ✅ UX (forms, validation, accessibility)

## 🎯 Running Tests

### All Tests
```bash
npm test
```

### Specific Test File
```bash
npm test auth.spec.ts
npm test profile.spec.ts
npm test projects.spec.ts
```

### Specific Browser
```bash
npm run test:chromium    # Chrome
npm run test:firefox     # Firefox
npm run test:webkit      # Safari
```

### Interactive UI Mode
```bash
npm run test:ui
```
Best for development - see tests run in real-time!

### Debug Mode
```bash
npm run test:debug
```
Step through tests with breakpoints.

### View HTML Report
```bash
npm run test:report
```

## 📁 Test Files

```
tests/
├── auth.spec.ts          # Login/signup (11 tests)
├── profile.spec.ts       # Profile management (54 tests)
├── projects.spec.ts      # Project CRUD (60 tests)
├── tasks.spec.ts         # Task management (75 tests)
├── dashboard.spec.ts     # Dashboard (36 tests)
├── admin.spec.ts         # Admin panel (54 tests)
├── landing.spec.ts       # Landing page (45 tests)
├── navigation.spec.ts    # Navigation (54 tests)
├── ux.spec.ts           # UX & accessibility (84 tests)
├── helpers.ts           # Utility functions
├── fixtures.ts          # Auth helpers
└── global-setup.ts      # Pre-test setup
```

## 🔧 Configuration

**playwright.config.ts** settings:
- Test timeout: 60 seconds
- Action timeout: 15 seconds
- Navigation timeout: 30 seconds
- Retries: 1 (dev), 2 (CI)
- Browsers: Chromium, Firefox, WebKit
- Authentication: Global setup with stored session

## 📝 Common Commands

```bash
# List all tests
npm test -- --list

# Run tests matching pattern
npm test -- --grep "login"

# Run single test
npm test -- -g "should create account"

# Update snapshots
npm test -- -u

# Clear cache
npx playwright clean

# Install browsers
npx playwright install
```

## 🐛 Troubleshooting

### Tests timing out?
- Check dev server is running: `npm run dev`
- Increase timeout in `playwright.config.ts`
- Run fewer tests: `npm test auth.spec.ts`

### Authentication failing?
- Check test user exists: `playwright.test@taskflow.com`
- Re-run global setup manually
- Check `.auth/user.json` exists

### Browser not found?
```bash
npx playwright install
```

### Tests failing after code changes?
- Update selectors in test files
- Check element IDs haven't changed
- Run in UI mode to debug: `npm run test:ui`

## 📊 Understanding Results

### Pass/Fail Summary
```
✅ Passed:   283 (82%)
❌ Failed:    60 (18%)
⏭️ Skipped:  123
```

### Where to find results:
- Terminal output (summary)
- `playwright-report/index.html` (detailed)
- `test-results/` (screenshots, traces)

### Analyzing Failures

1. **Check terminal output** for error message
2. **View screenshot** in `test-results/`
3. **Open HTML report**: `npm run test:report`
4. **View trace** for detailed timeline:
   ```bash
   npx playwright show-trace test-results/.../trace.zip
   ```

## ✨ Best Practices

### Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/page.html');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const button = page.locator('#myButton');

    // Act
    await button.click();

    // Assert
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### Using Helpers

```typescript
import { fillField, submitForm } from './helpers';

await fillField(page, '#email', 'test@example.com');
await submitForm(page);
```

### Using Auth Fixture

```typescript
import { test, expect } from './fixtures';

test('authenticated test', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in!
  await authenticatedPage.goto('/dashboard.html');
});
```

## 🎯 CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm install
      - run: npx playwright install --with-deps
      - run: npm test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 📚 Resources

- [Playwright Docs](https://playwright.dev)
- [Test README](tests/README.md)
- [Final Results](../FINAL_TEST_RESULTS.md)
- [Execution Guide](../TEST_EXECUTION_GUIDE.md)

## 🎉 You're Ready!

Your test suite is set up and ready to use. Run `npm run test:ui` to see tests in action!

**Happy Testing! 🧪**
