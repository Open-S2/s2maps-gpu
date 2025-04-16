import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->LCH->Default', async ({ page }) => {
  await page.goto('/s2/lch', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-lch.png', { timeout: 2_000 });
});

test('WM->LCH->Default', async ({ page }) => {
  await page.goto('/wm/lch', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-lch.png', { timeout: 2_000 });
});

// test('S2->LCH->WebGL', async ({ page }) => {
//   await page.goto('/s2/lch/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-lch-webgl.png', { timeout: 2_000 })
// })

// test('WM->LCH->WebGL', async ({ page }) => {
//   await page.goto('/wm/lch/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-lch-webgl.png', { timeout: 2_000 })
// })

test('S2->LCH->WebGL2', async ({ page }) => {
  await page.goto('/s2/lch/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-lch-webgl2.png', { timeout: 2_000 });
});

test('WM->LCH->WebGL2', async ({ page }) => {
  await page.goto('/wm/lch/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-lch-webgl2.png', { timeout: 2_000 });
});

test('S2->LCH->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/lch/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-lch-webgpu.png', { timeout: 2_000 });
});

test('WM->LCH->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/lch/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-lch-webgpu.png', { timeout: 2_000 });
});
