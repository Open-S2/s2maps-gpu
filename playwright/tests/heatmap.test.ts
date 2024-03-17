import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->Heatmap->Default', async ({ page }) => {
  await page.goto('/s2/heatmap', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-heatmap.png', { timeout: 2_000 })
})

test('WM->Heatmap->Default', async ({ page }) => {
  await page.goto('/wm/heatmap', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-heatmap.png', { timeout: 2_000 })
})

test('S2->Heatmap->WebGL', async ({ page }) => {
  await page.goto('/s2/heatmap/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-heatmap-webgl.png', { timeout: 2_000 })
})

test('WM->Heatmap->WebGL', async ({ page }) => {
  await page.goto('/wm/heatmap/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-heatmap-webgl.png', { timeout: 2_000 })
})

test('S2->Heatmap->WebGL2', async ({ page }) => {
  await page.goto('/s2/heatmap/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-heatmap-webgl2.png', { timeout: 2_000 })
})

test('WM->Heatmap->WebGL2', async ({ page }) => {
  await page.goto('/wm/heatmap/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-heatmap-webgl2.png', { timeout: 2_000 })
})

test('S2->Heatmap->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/heatmap/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-heatmap-webgpu.png', { timeout: 2_000 })
})

test('WM->Heatmap->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/heatmap/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-heatmap-webgpu.png', { timeout: 2_000 })
})
