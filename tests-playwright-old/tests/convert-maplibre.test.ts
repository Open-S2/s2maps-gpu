import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('WM->ConvertMaplibre->Default', async ({ page }) => {
  await page.goto('/wm/convert-maplibre', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-convert-maplibre.png', { timeout: 2_000 });
});

// test('WM->ConvertMaplibre->WebGL', async ({ page }) => {
//   await page.goto('/wm/convert-maplibre/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-convert-maplibre-webgl.png', { timeout: 2_000 })
// })

test('WM->ConvertMaplibre->WebGL2', async ({ page }) => {
  await page.goto('/wm/convert-maplibre/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-convert-maplibre-webgl2.png', { timeout: 2_000 });
});

test('WM->ConvertMaplibre->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/convert-maplibre/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-convert-maplibre-webgpu.png', { timeout: 2_000 });
});
