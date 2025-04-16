import { defineConfig, devices } from '@playwright/test';

const CI_BOOL = Boolean(process.env.CI);

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: './tests',
  /* The base directory, relative to the config file, for snapshot files created with toMatchSnapshot and toHaveScreenshot. */
  snapshotDir: './__snapshots__',
  /* Update snapshots on CI. */
  updateSnapshots: 'missing', // 'all', 'none', 'missing'
  /* Maximum time one test can run for. */
  timeout: 15 * 1_000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: CI_BOOL ?? true,
  /* Number of retries before conceding to a failure */
  retries: 4,
  /* Opt out of parallel tests on CI. */
  workers: CI_BOOL ? 1 : 3,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Base URL for all the tests. e.g. page.goto('/s2/fill') will route to 'http://127.0.0.1:3000/s2/fill' */
    baseURL: 'http://127.0.0.1:3000',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Test against desktop browsers */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] }
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] }
    // },
    // /* Test against branded browsers. */
    // NOTE: I don't know why but these refuse to work consistently (but works when testing dev locally)
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' } // or 'chrome-beta'
    // },
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' } // or 'msedge-dev'
    // }
  ],

  /* Configure dev server for tests */
  webServer: {
    command: 'bun run dev:playwright',
    url: 'http://127.0.0.1:3000/s2/background/webgl',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: '../',
  },
});
