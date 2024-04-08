import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->Local->Default', async ({ page }) => {
  await page.goto('/s2/local', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-local.png', { timeout: 2_000 })
})

test('WM->Local->Default', async ({ page }) => {
  await page.goto('/wm/local', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-local.png', { timeout: 2_000 })
})

// test('S2->Local->WebGL', async ({ page }) => {
//   await page.goto('/s2/local/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-local-webgl.png', { timeout: 2_000 })
// })

// test('WM->Local->WebGL', async ({ page }) => {
//   await page.goto('/wm/local/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-local-webgl.png', { timeout: 2_000 })
// })

test('S2->Local->WebGL2', async ({ page }) => {
  await page.goto('/s2/local/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-local-webgl2.png', { timeout: 2_000 })
})

test('WM->Local->WebGL2', async ({ page }) => {
  await page.goto('/wm/local/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-local-webgl2.png', { timeout: 2_000 })
})

test('S2->Local->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/local/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-local-webgpu.png', { timeout: 2_000 })
})

test('WM->Local->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/local/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-local-webgpu.png', { timeout: 2_000 })
})
