import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->Fill->WebGL', async ({ page }) => {
  await page.goto('/s2/fill/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-fill-webgl.png', { timeout: 2_000 })
})

test('S2->Fill->WebGL2', async ({ page }) => {
  await page.goto('/s2/fill/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-fill-webgl2.png', { timeout: 2_000 })
})

test('S2->Fill->WebGPU', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' || browserName === 'firefox')
  await page.goto('/s2/fill/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-fill-webgpu.png', { timeout: 2_000 })
})
