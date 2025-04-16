import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('WM->Hillshade->Default', async ({ page }) => {
  await page.goto('/wm/hillshade', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-hillshade.png', { timeout: 2_000 });
});

// test('WM->Hillshade->WebGL', async ({ page }) => {
//   await page.goto('/wm/hillshade/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-hillshade-webgl.png', { timeout: 2_000 })
// })

test('WM->Hillshade->WebGL2', async ({ page }) => {
  await page.goto('/wm/hillshade/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-hillshade-webgl2.png', { timeout: 2_000 });
});

test('WM->Hillshade->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/hillshade/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-hillshade-webgpu.png', { timeout: 2_000 });
});
