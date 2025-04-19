import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { fileURLToPath } from 'url';
import glsl from '../config/glsl-loader/vite.js';
import vue from '@vitejs/plugin-vue';
import wgsl from '../config/wgsl-loader/vite.js';
import { defineConfig, devices } from '@playwright/experimental-ct-vue';

// https://github.com/mxschmitt/playwright-test-coverage/tree/ct-react-vite
// const istanbulPlugin = istanbul({
//   include: 's2/*',
//   extension: ['.js', '.ts', '.vue', '.tsx', '.svelte'],
//   forceBuildInstrument: true,
// });

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: './tests',
  /* The base directory, relative to the config file, for snapshot files created with toMatchSnapshot and toHaveScreenshot. */
  snapshotDir: './__snapshots__',
  /* Maximum time one test can run for. */
  timeout: 10 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: true,
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
    ctPort: 3100,
    ctViteConfig: {
      plugins: [
        glsl(),
        wgsl(),
        vue(),
        AutoImport({
          imports: ['vue', 'vue-router', '@vueuse/head'],
          dts: 'src/auto-imports.d.ts',
          // eslintrc: { enabled: true },
        }),
        Components({ dirs: ['./components'], extensions: ['vue'] }),
      ],
      build: {
        sourcemap: 'inline',
      },
      worker: {
        format: 'es',
        /** @returns the inject plugins */
        plugins: () => [glsl(), wgsl()],
      },
      resolve: {
        alias: {
          s2: fileURLToPath(new URL('../s2', import.meta.url)),
          'gis-tools': fileURLToPath(new URL('../s2/gis-tools', import.meta.url)),
          gl: fileURLToPath(new URL('../s2/gl', import.meta.url)),
          gpu: fileURLToPath(new URL('../s2/gpu', import.meta.url)),
          plugins: fileURLToPath(new URL('../s2/plugins', import.meta.url)),
          source: fileURLToPath(new URL('../s2/source', import.meta.url)),
          style: fileURLToPath(new URL('../s2/style', import.meta.url)),
          svg: fileURLToPath(new URL('../s2/svg', import.meta.url)),
          ui: fileURLToPath(new URL('../s2/ui', import.meta.url)),
          util: fileURLToPath(new URL('../s2/util', import.meta.url)),
          workers: fileURLToPath(new URL('../s2/workers', import.meta.url)),
        },
      },
    },
  },

  /* Configure projects for major browsers */
  projects: [
    /* Test against desktop browsers */
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    /* Test against mobile viewports. */
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
    /* Test against branded browsers. */
    // { name: 'Google Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    // { name: 'Google Chrome Beta', use: { ...devices['Desktop Chrome'], channel: 'chrome-beta' } },
    // { name: 'Microsoft Edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    // {
    //   name: 'Microsoft Edge Developer Edition',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge-dev' },
    // },
  ],

  webServer: {
    command: 'bun run ./server.ts',
    url: 'http://localhost:3000',
    timeout: 5 * 1_000,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
