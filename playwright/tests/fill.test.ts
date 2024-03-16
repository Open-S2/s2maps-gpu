// import { expect, test } from '@playwright/test'
// import { waitMap } from './util'

// test('S2->Fill->Default', async ({ page }) => {
//   await page.goto('/s2/fill', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-fill.png', { timeout: 2_000 })
// })

// test('WM->Fill->Default', async ({ page }) => {
//   await page.goto('/wm/fill', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-fill.png', { timeout: 2_000 })
// })

// test('S2->Fill->WebGL', async ({ page }) => {
//   await page.goto('/s2/fill/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-fill-webgl.png', { timeout: 2_000 })
// })

// test('WM->Fill->WebGL', async ({ page }) => {
//   await page.goto('/wm/fill/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-fill-webgl.png', { timeout: 2_000 })
// })

// test('S2->Fill->WebGL2', async ({ page }) => {
//   await page.goto('/s2/fill/webgl2', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-fill-webgl2.png', { timeout: 2_000 })
// })

// test('WM->Fill->WebGL2', async ({ page }) => {
//   await page.goto('/wm/fill/webgl2', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-fill-webgl2.png', { timeout: 2_000 })
// })

// test('S2->Fill->WebGPU', async ({ page, browserName }) => {
//   await page.goto('/s2/fill/webgpu', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   const evaluation = await page.evaluate(waitMap)
//   // expect webkit and firefox to fail
//   expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
//   await expect(page).toHaveScreenshot('s2-fill-webgpu.png', { timeout: 2_000 })
// })

// test('WM->Fill->WebGPU', async ({ page, browserName }) => {
//   await page.goto('/wm/fill/webgpu', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   const evaluation = await page.evaluate(waitMap)
//   // expect webkit and firefox to fail
//   expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
//   await expect(page).toHaveScreenshot('wm-fill-webgpu.png', { timeout: 2_000 })
// })
