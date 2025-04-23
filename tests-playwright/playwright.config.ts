import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { fileURLToPath } from 'url';
import glsl from '../config/glsl-loader/vite.js';
import vue from '@vitejs/plugin-vue';
import wgsl from '../config/wgsl-loader/vite.js';
import { defineConfig, devices } from '@playwright/experimental-ct-vue';

import IstanbulPlugin from 'vite-plugin-istanbul';

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: './tests',
  /* The base directory, relative to the config file, for snapshot files created with toMatchSnapshot and toHaveScreenshot. */
  snapshotDir: './__snapshots__',
  /* Maximum time one test can run for. */
  timeout: 10 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: process.env.CI === undefined,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: true,
  /* Retries if test fails */
  retries: 4,
  failOnFlakyTests: false,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI !== undefined ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    trace: 'on-first-retry',
    ctPort: 3100,
    baseURL: 'http://localhost:3100',
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
        IstanbulPlugin({
          include: ['s2/*', 's2/**/*'],
          exclude: ['node_modules', 'test/'],
          extension: ['.js', '.ts', '.vue'],
          nycrcPath: './nyc.config.js',
          requireEnv: false,
          forceBuildInstrument: true,
        }),
      ],
      worker: {
        format: 'es',
        /** @returns the inject plugins */
        plugins: () => [
          glsl(),
          wgsl(),
          IstanbulPlugin({
            include: ['s2/*', 's2/**/*'],
            exclude: ['node_modules', 'test/'],
            extension: ['.js', '.ts', '.vue'],
            nycrcPath: './nyc.config.js',
            requireEnv: false,
            forceBuildInstrument: true,
          }),
        ],
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
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    /* Test against mobile viewports. */
    // { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    // { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
    /* Test against branded browsers. */
    // { name: 'Google Chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    // { name: 'Google Chrome Beta', use: { ...devices['Desktop Chrome'], channel: 'chrome-beta' } },
    // { name: 'Microsoft Edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ],

  webServer: {
    command: 'bun server:playwright',
    url: 'http://localhost:3030',
    timeout: 5 * 1_000,
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
