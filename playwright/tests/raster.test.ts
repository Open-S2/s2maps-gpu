import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->Raster->Default', async ({ page }) => {
  await page.goto('/s2/raster', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-raster.png', { timeout: 2_000 })
})

test('WM->Raster->Default', async ({ page }) => {
  await page.goto('/wm/raster', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-raster.png', { timeout: 2_000 })
})

// TODO: fix these tests
// test('S2->Raster->WebGL', async ({ page }) => {
//   await page.goto('/s2/raster/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-raster-webgl.png', { timeout: 2_000 })
// })

// TODO: fix these tests
// test('WM->Raster->WebGL', async ({ page }) => {
//   await page.goto('/wm/raster/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-raster-webgl.png', { timeout: 2_000 })
// })

test('S2->Raster->WebGL2', async ({ page }) => {
  await page.goto('/s2/raster/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-raster-webgl2.png', { timeout: 2_000 })
})

test('WM->Raster->WebGL2', async ({ page }) => {
  await page.goto('/wm/raster/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-raster-webgl2.png', { timeout: 2_000 })
})

test('S2->Raster->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/raster/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-raster-webgpu.png', { timeout: 2_000 })
})

test('WM->Raster->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/raster/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-raster-webgpu.png', { timeout: 2_000 })
})
