import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
import vue from '@vitejs/plugin-vue';
import { defineConfig, devices } from '@playwright/experimental-ct-vue';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* The base directory, relative to the config file, for snapshot files created with toMatchSnapshot and toHaveScreenshot. */
  snapshotDir: './__snapshots__',
  /* Maximum time one test can run for. */
  timeout: 10 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */

  retries: 4,
  /* Opt out of parallel tests on CI. */
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [
        vue(),
        tsconfigPaths({
          configNames: ['tsconfig.eslint.json'],
        }),
        AutoImport({
          imports: [
            'vue',
            'vue-router',
            '@vueuse/head',
            // 'pinia',
            // {
            //   '@/store': ['useStore']
            // }
          ],
          dts: 'src/auto-imports.d.ts',
          eslintrc: {
            enabled: true,
          },
        }),
        Components({
          dirs: ['./components'],
          extensions: ['vue'],
        }),
      ],
      resolve: {
        alias: {
          s2: resolve(__dirname, '../s2'),
          //     geometry: resolve(__dirname, '../s2/geometry'),
          //     gl: resolve(__dirname, '../s2/gl'),
          //     gpu: resolve(__dirname, '../s2/gpu'),
          //     plugins: resolve(__dirname, '../s2/plugins'),
          //     source: resolve(__dirname, '../s2/source'),
          //     style: resolve(__dirname, '../s2/style'),
          //     ui: resolve(__dirname, '../s2/ui'),
          //     util: resolve(__dirname, '../s2/util'),
          //     workers: resolve(__dirname, '../s2/workers')
        },
      },
    },
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
    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    /* Test against branded browsers. */
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'Google Chrome Beta',
      use: { ...devices['Desktop Chrome'], channel: 'chrome-beta' },
    },
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Microsoft Edge Developer Edition',
      use: { ...devices['Desktop Edge'], channel: 'msedge-dev' },
    },
  ],

  webServer: {
    command: 'bun run ./server.ts',
    url: 'http://localhost:8080/ping',
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
