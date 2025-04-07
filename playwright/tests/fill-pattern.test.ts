import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->FillPattern->Default', async ({ page }) => {
  await page.goto('/s2/fill-pattern', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-fill-pattern.png', { timeout: 2_000 });
});

test('WM->FillPattern->Default', async ({ page }) => {
  await page.goto('/wm/fill-pattern', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-fill-pattern.png', { timeout: 2_000 });
});

// test('S2->FillPattern->WebGL', async ({ page }) => {
//   await page.goto('/s2/fill-pattern/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-fill-pattern-webgl.png', { timeout: 2_000 })
// })

// test('WM->FillPattern->WebGL', async ({ page }) => {
//   await page.goto('/wm/fill-pattern/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-fill-pattern-webgl.png', { timeout: 2_000 })
// })

test('S2->FillPattern->WebGL2', async ({ page }) => {
  await page.goto('/s2/fill-pattern/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-fill-pattern-webgl2.png', { timeout: 2_000 });
});

test('WM->FillPattern->WebGL2', async ({ page }) => {
  await page.goto('/wm/fill-pattern/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-fill-pattern-webgl2.png', { timeout: 2_000 });
});

test('S2->FillPattern->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/fill-pattern/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-fill-pattern-webgpu.png', { timeout: 2_000 });
});

test('WM->FillPattern->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/fill-pattern/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-fill-pattern-webgpu.png', { timeout: 2_000 });
});
