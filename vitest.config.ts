import baseViteConfig from './vite.config';
import { defineConfig } from 'vitest/config';

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
      provider: 'playwright', // or 'webdriverio'
      enabled: true,
      instances: [
        {
          browser: 'chromium',
          launch: {
            headless: true,
            args: [
              // '--use-angle=vulkan',
              // '--enable-features=Vulkan',
              // '--disable-vulkan-surface',
              '--enable-unsafe-webgpu',
            ],
          },
          context: {
            viewport: {
              width: 1920,
              height: 1080,
            },
            screen: {
              width: 1920,
              height: 1080,
            },
          },
        },
      ], // { browser: 'firefox' }
    },
    coverage: {
      provider: 'v8',
      // extends: '@istanbuljs/nyc-config-typescript',
      include: ['s2'],
      all: true,
      reporter: ['html-spa', 'lcovonly', 'cobertura', 'text-summary'],
    },
  },
});
