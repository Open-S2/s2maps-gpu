import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('WM->ConvertS2JSON->Default', async ({ page }) => {
  await page.goto('/wm/convert-s2json', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-convert-s2json.png', { timeout: 2_000 })
})

test('WM->ConvertS2JSON->WebGL', async ({ page }) => {
  await page.goto('/wm/convert-s2json/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-convert-s2json-webgl.png', { timeout: 2_000 })
})

test('WM->ConvertS2JSON->WebGL2', async ({ page }) => {
  await page.goto('/wm/convert-s2json/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-convert-s2json-webgl2.png', { timeout: 2_000 })
})

test('WM->ConvertS2JSON->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/convert-s2json/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-convert-s2json-webgpu.png', { timeout: 2_000 })
})
