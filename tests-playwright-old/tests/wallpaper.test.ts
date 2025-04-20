import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('S2->Wallpaper->Default', async ({ page }) => {
  await page.goto('/s2/wallpaper', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-wallpaper.png', { timeout: 2_000 });
});

// test('S2->Wallpaper->WebGL', async ({ page }) => {
//   await page.goto('/s2/wallpaper/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForTimeout(3_500)
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-wallpaper-webgl.png', { timeout: 2_000 })
// })

test('S2->Wallpaper->WebGL2', async ({ page }) => {
  await page.goto('/s2/wallpaper/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-wallpaper-webgl2.png', { timeout: 2_000 });
});

test('S2->Wallpaper->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/wallpaper/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-wallpaper-webgpu.png', { timeout: 2_000 });
});
