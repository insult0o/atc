import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PDF Intelligence Platform E2E tests
 */
export default defineConfig({
  testDir: './test/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./test/e2e/reporters/workflow-reporter.ts'],
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Maximum time each action can take */
    actionTimeout: 10000,

    /* Test timeout */
    navigationTimeout: 30000,
  },

  /* Global setup */
  globalSetup: require.resolve('./test/e2e/global.setup.ts'),

  /* Configure projects for major browsers and workflows */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'quick-extract',
      testDir: './test/e2e/workflows/quick-extract',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'detailed-review',
      testDir: './test/e2e/workflows/detailed-review',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'collaborative',
      testDir: './test/e2e/workflows/collaborative',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'batch-processing',
      testDir: './test/e2e/workflows/batch-processing',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'api-integration',
      testDir: './test/e2e/workflows/api-integration',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'visual-regression',
      testDir: './test/e2e/visual',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      testDir: './test/e2e',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.NO_WEBSERVER ? undefined : [
    {
      command: 'npm run dev',
      port: 3000,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    // Backend server is optional for initial testing
    // {
    //   command: 'cd backend && uvicorn app.main:app --reload --port 8000',
    //   port: 8000,
    //   timeout: 120 * 1000,
    //   reuseExistingServer: !process.env.CI,
    // },
  ],
});