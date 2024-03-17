import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->InvertPattern->Default', async ({ page }) => {
  await page.goto('/s2/invert-pattern', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-invert-pattern.png', { timeout: 2_000 })
})

test('WM->InvertPattern->Default', async ({ page }) => {
  await page.goto('/wm/invert-pattern', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-invert-pattern.png', { timeout: 2_000 })
})

test('S2->InvertPattern->WebGL', async ({ page }) => {
  await page.goto('/s2/invert-pattern/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-invert-pattern-webgl.png', { timeout: 2_000 })
})

test('WM->InvertPattern->WebGL', async ({ page }) => {
  await page.goto('/wm/invert-pattern/webgl', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-invert-pattern-webgl.png', { timeout: 2_000 })
})

test('S2->InvertPattern->WebGL2', async ({ page }) => {
  await page.goto('/s2/invert-pattern/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-invert-pattern-webgl2.png', { timeout: 2_000 })
})

test('WM->InvertPattern->WebGL2', async ({ page }) => {
  await page.goto('/wm/invert-pattern/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-invert-pattern-webgl2.png', { timeout: 2_000 })
})

test('S2->InvertPattern->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/invert-pattern/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-invert-pattern-webgpu.png', { timeout: 2_000 })
})

test('WM->InvertPattern->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/invert-pattern/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-invert-pattern-webgpu.png', { timeout: 2_000 })
})
