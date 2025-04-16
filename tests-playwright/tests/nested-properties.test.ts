import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->NestedProperties->Default', async ({ page }) => {
  await page.goto('/s2/nested-properties', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-nested-properties.png', { timeout: 2_000 });
});

test('WM->NestedProperties->Default', async ({ page }) => {
  await page.goto('/wm/nested-properties', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-nested-properties.png', { timeout: 2_000 });
});

// test('S2->NestedProperties->WebGL', async ({ page }) => {
//   await page.goto('/s2/nested-properties/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-nested-properties-webgl.png', { timeout: 2_000 })
// })

// test('WM->NestedProperties->WebGL', async ({ page }) => {
//   await page.goto('/wm/nested-properties/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-nested-properties-webgl.png', { timeout: 2_000 })
// })

test('S2->NestedProperties->WebGL2', async ({ page }) => {
  await page.goto('/s2/nested-properties/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-nested-properties-webgl2.png', { timeout: 2_000 });
});

test('WM->NestedProperties->WebGL2', async ({ page }) => {
  await page.goto('/wm/nested-properties/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-nested-properties-webgl2.png', { timeout: 2_000 });
});

test('S2->NestedProperties->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/nested-properties/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-nested-properties-webgpu.png', { timeout: 2_000 });
});

test('WM->NestedProperties->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/nested-properties/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-nested-properties-webgpu.png', { timeout: 2_000 });
});
