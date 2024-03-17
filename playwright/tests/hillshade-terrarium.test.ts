import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('WM->HillshadeTerrarium->Default', async ({ page }) => {
  await page.goto('/wm/hillshade-terrarium', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-hillshade-terrarium.png', { timeout: 2_000 })
})

test('WM->HillshadeTerrarium->WebGL', async ({ page }) => {
  await page.goto('/wm/hillshade-terrarium/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-hillshade-terrarium-webgl.png', { timeout: 2_000 })
})

test('WM->HillshadeTerrarium->WebGL2', async ({ page }) => {
  await page.goto('/wm/hillshade-terrarium/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-hillshade-terrarium-webgl2.png', { timeout: 2_000 })
})

test('WM->HillshadeTerrarium->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/hillshade-terrarium/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-hillshade-terrarium-webgpu.png', { timeout: 2_000 })
})
