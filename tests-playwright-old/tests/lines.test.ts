import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->Lines->Default', async ({ page }) => {
  await page.goto('/s2/lines', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-lines.png', { timeout: 2_000 });
});

test('WM->Lines->Default', async ({ page }) => {
  await page.goto('/wm/lines', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-lines.png', { timeout: 2_000 });
});

// test('S2->Lines->WebGL', async ({ page }) => {
//   await page.goto('/s2/lines/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-lines-webgl.png', { timeout: 2_000 })
// })

// test('WM->Lines->WebGL', async ({ page }) => {
//   await page.goto('/wm/lines/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-lines-webgl.png', { timeout: 2_000 })
// })

test('S2->Lines->WebGL2', async ({ page }) => {
  await page.goto('/s2/lines/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-lines-webgl2.png', { timeout: 2_000 });
});

test('WM->Lines->WebGL2', async ({ page }) => {
  await page.goto('/wm/lines/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-lines-webgl2.png', { timeout: 2_000 });
});

test('S2->Lines->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/lines/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-lines-webgpu.png', { timeout: 2_000 });
});

test('WM->Lines->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/lines/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-lines-webgpu.png', { timeout: 2_000 });
});
