import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->Invert->Default', async ({ page }) => {
  await page.goto('/s2/invert', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-invert.png', { timeout: 2_000 });
});

test('WM->Invert->Default', async ({ page }) => {
  await page.goto('/wm/invert', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-invert.png', { timeout: 2_000 });
});

// test('S2->Invert->WebGL', async ({ page }) => {
//   await page.goto('/s2/invert/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-invert-webgl.png', { timeout: 2_000 })
// })

// test('WM->Invert->WebGL', async ({ page }) => {
//   await page.goto('/wm/invert/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-invert-webgl.png', { timeout: 2_000 })
// })

test('S2->Invert->WebGL2', async ({ page }) => {
  await page.goto('/s2/invert/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-invert-webgl2.png', { timeout: 2_000 });
});

test('WM->Invert->WebGL2', async ({ page }) => {
  await page.goto('/wm/invert/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-invert-webgl2.png', { timeout: 2_000 });
});

test('S2->Invert->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/invert/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-invert-webgpu.png', { timeout: 2_000 });
});

test('WM->Invert->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/invert/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-invert-webgpu.png', { timeout: 2_000 });
});
