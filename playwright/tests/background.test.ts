import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('WM->Background->Default', async ({ page }) => {
  await page.goto('/wm/background', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-background.png', { timeout: 2_000 })
})

test('S2->Background->Default', async ({ page }) => {
  await page.goto('/s2/background', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background.png', { timeout: 2_000 })
})

test('WM->Background->WebGL', async ({ page }) => {
  await page.goto('/wm/background/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-background-webgl.png', { timeout: 2_000 })
})

test('S2->Background->WebGL', async ({ page }) => {
  await page.goto('/s2/background/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background-webgl.png', { timeout: 2_000 })
})

test('WM->Background->WebGL2', async ({ page }) => {
  await page.goto('/wm/background/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-background-webgl2.png', { timeout: 2_000 })
})

test('S2->Background->WebGL2', async ({ page }) => {
  await page.goto('/s2/background/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-background-webgl2.png', { timeout: 2_000 })
})

test('WM->Background->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/background/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-background-webgpu.png', { timeout: 2_000 })
})

test('S2->Background->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/background/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-background-webgpu.png', { timeout: 2_000 })
})
