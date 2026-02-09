import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000, // Increase test timeout to 60 seconds
  globalSetup: './tests/global-setup.ts', // Run login before all tests
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000, // Increase action timeout to 15 seconds
    navigationTimeout: 30000, // Increase navigation timeout to 30 seconds
    storageState: 'tests/.auth/user.json', // Use stored auth session
  },

  projects: [
    // Setup project that runs first
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },

    // Auth tests - no stored state (testing login/signup)
    {
      name: 'auth-chromium',
      testMatch: /auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined, // Don't use stored auth for auth tests
      },
    },

    // All other tests - with stored auth
    {
      name: 'chromium',
      testIgnore: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      testIgnore: /auth\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      testIgnore: /auth\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
