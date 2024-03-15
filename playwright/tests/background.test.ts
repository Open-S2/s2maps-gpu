import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->Background->WebGL', async ({ page }) => {
  await page.goto('/s2/background/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background-webgl.png', { timeout: 2_000 })
})

test('S2->Background->WebGL2', async ({ page }) => {
  await page.goto('/s2/background/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background-webgl2.png', { timeout: 2_000 })
})

test('S2->Background->WebGPU', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit' || browserName === 'firefox')
  await page.goto('/s2/background/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background-webgpu.png', { timeout: 2_000 })
})
