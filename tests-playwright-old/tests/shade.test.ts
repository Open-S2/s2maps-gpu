import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('S2->Shade->Default', async ({ page }) => {
  await page.goto('/s2/shade', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-shade.png', { timeout: 2_000 });
});

// test('S2->Shade->WebGL', async ({ page }) => {
//   await page.goto('/s2/shade/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-shade-webgl.png', { timeout: 2_000 })
// })

test('S2->Shade->WebGL2', async ({ page }) => {
  await page.goto('/s2/shade/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-shade-webgl2.png', { timeout: 2_000 });
});

test('S2->Shade->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/shade/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-shade-webgpu.png', { timeout: 2_000 });
});
