import baseViteConfig from './vite.config';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  ...baseViteConfig,
  test: {
    retry: 3,
    slowTestThreshold: 15_000,
    testTimeout: 10_000,
    include: ['tests/**/*.test.ts'],
    name: 'browser',
    setupFiles: ['./tests/browsers/setup.ts'],
    expandSnapshotDiff: true,
    browser: {
      headless: true,
      provider: playwright(), // or 'webdriverio'
      enabled: true,
      instances: [
        {
          browser: 'chromium',
          headless: true,
          viewport: { width: 1920, height: 1080 },
          // screen: { width: 1920, height: 1080 },
          execArgv: ['--enable-unsafe-webgpu'],
          // launch: {
          //   headless: true,
          //   args: ['--enable-unsafe-webgpu'],
          // },
          // context: {
          //   viewport: { width: 1920, height: 1080 },
          //   screen: { width: 1920, height: 1080 },
          // },
        },
      ], // { browser: 'firefox' }
    },
    coverage: {
      provider: 'v8',
      // extends: '@istanbuljs/nyc-config-typescript',
      include: ['s2'],
      // all: true,
      clean: true,
      enabled: true,
      reporter: ['html-spa', 'lcovonly', 'cobertura', 'text-summary'],
    },
  },
});
