import { waitMap } from './util.js';
import { expect, test } from '@playwright/test';

test('WM->Cluster->Default', async ({ page }) => {
  await page.goto('/wm/cluster', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-cluster.png', { timeout: 2_000 });
});

// test('WM->Cluster->WebGL', async ({ page }) => {
//   await page.goto('/wm/cluster/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-cluster-webgl.png', { timeout: 2_000 })
// })

test('WM->Cluster->WebGL2', async ({ page }) => {
  await page.goto('/wm/cluster/webgl2', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  await page.evaluate(waitMap);
  await expect(page).toHaveScreenshot('wm-cluster-webgl2.png', { timeout: 2_000 });
});

test('WM->Cluster->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/cluster/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-cluster-webgpu.png', { timeout: 2_000 });
});
