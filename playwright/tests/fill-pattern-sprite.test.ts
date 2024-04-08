import { expect, test } from '@playwright/test'
import { waitMap } from './util'

test('S2->FillPatternSprite->Default', async ({ page }) => {
  await page.goto('/s2/fill-pattern-sprite', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-fill-pattern-sprite.png', { timeout: 2_000 })
})

test('WM->FillPatternSprite->Default', async ({ page }) => {
  await page.goto('/wm/fill-pattern-sprite', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-fill-pattern-sprite.png', { timeout: 2_000 })
})

// test('S2->FillPatternSprite->WebGL', async ({ page }) => {
//   await page.goto('/s2/fill-pattern-sprite/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-fill-pattern-sprite-webgl.png', { timeout: 2_000 })
// })

// test('WM->FillPatternSprite->WebGL', async ({ page }) => {
//   await page.goto('/wm/fill-pattern-sprite/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-fill-pattern-sprite-webgl.png', { timeout: 2_000 })
// })

test('S2->FillPatternSprite->WebGL2', async ({ page }) => {
  await page.goto('/s2/fill-pattern-sprite/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('s2-fill-pattern-sprite-webgl2.png', { timeout: 2_000 })
})

test('WM->FillPatternSprite->WebGL2', async ({ page }) => {
  await page.goto('/wm/fill-pattern-sprite/webgl2', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  await page.evaluate(waitMap)
  await expect(page).toHaveScreenshot('wm-fill-pattern-sprite-webgl2.png', { timeout: 2_000 })
})

test('S2->FillPatternSprite->WebGPU', async ({ page, browserName }) => {
  await page.goto('/s2/fill-pattern-sprite/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('s2-fill-pattern-sprite-webgpu.png', { timeout: 2_000 })
})

test('WM->FillPatternSprite->WebGPU', async ({ page, browserName }) => {
  await page.goto('/wm/fill-pattern-sprite/webgpu', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
  const evaluation = await page.evaluate(waitMap)
  // expect webkit and firefox to fail
  expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
  await expect(page).toHaveScreenshot('wm-fill-pattern-sprite-webgpu.png', { timeout: 2_000 })
})
