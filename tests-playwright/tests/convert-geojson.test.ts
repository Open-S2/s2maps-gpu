import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('S2->ConvertGeoJSON->Default', async ({ page }) => {
  await page.goto('/s2/convert-geojson', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-convert-geojson.png', { timeout: 2_000 });
});

// test('S2->ConvertGeoJSON->WebGL', async ({ page }) => {
//   await page.goto('/s2/convert-geojson/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-convert-geojson-webgl.png', { timeout: 2_000 })
// })

test('S2->ConvertGeoJSON->WebGL2', async ({ page }) => {
  await page.goto('/s2/convert-geojson/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('s2-convert-geojson-webgl2.png', { timeout: 2_000 });
});

test('S2->ConvertGeoJSON->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/convert-geojson/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-convert-geojson-webgpu.png', { timeout: 2_000 });
});
