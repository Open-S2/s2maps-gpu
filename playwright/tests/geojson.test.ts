import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('WM->GeoJSON->Default', async ({ page }) => {
  await page.goto('/wm/geojson', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-geojson.png', { timeout: 2_000 })
})

// test('WM->GeoJSON->WebGL', async ({ page }) => {
//   await page.goto('/wm/geojson/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-geojson-webgl.png', { timeout: 2_000 })
// })

test('WM->GeoJSON->WebGL2', async ({ page }) => {
  await page.goto('/wm/geojson/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-geojson-webgl2.png', { timeout: 2_000 })
})

test('WM->GeoJSON->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/geojson/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-geojson-webgpu.png', { timeout: 2_000 })
})
