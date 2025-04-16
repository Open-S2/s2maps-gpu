import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('S2->Points->Default', async ({ page }) => {
  await page.goto('/s2/points', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-points.png', { timeout: 2_000 });
});

test('WM->Points->Default', async ({ page }) => {
  await page.goto('/wm/points', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-points.png', { timeout: 2_000 });
});

// test('S2->Points->WebGL', async ({ page }) => {
//   await page.goto('/s2/points/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-points-webgl.png', { timeout: 2_000 })
// })

// test('WM->Points->WebGL', async ({ page }) => {
//   await page.goto('/wm/points/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-points-webgl.png', { timeout: 2_000 })
// })

test('S2->Points->WebGL2', async ({ page }) => {
  await page.goto('/s2/points/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-points-webgl2.png', { timeout: 2_000 });
});

test('WM->Points->WebGL2', async ({ page }) => {
  await page.goto('/wm/points/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-points-webgl2.png', { timeout: 2_000 });
});

test('S2->Points->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/points/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-points-webgpu.png', { timeout: 2_000 });
});

test('WM->Points->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/points/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-points-webgpu.png', { timeout: 2_000 });
});
