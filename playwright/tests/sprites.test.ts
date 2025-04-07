import { waitMap } from './util';
import { expect, test } from '@playwright/test';

test('S2->Sprites->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/sprites/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('s2-sprites-webgpu.png', { timeout: 2_000 });
});

test('WM->Sprites->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/sprites/webgpu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 });
  const evaluation = await page.evaluate(waitMap);
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'));
  await expect(page).toHaveScreenshot('wm-sprites-webgpu.png', { timeout: 2_000 });
});
