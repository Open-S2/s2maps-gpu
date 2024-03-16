// import { expect, test } from '@playwright/test'
// import { waitMap } from './util'

// test('WM->Markers->Default', async ({ page }) => {
//   await page.goto('/wm/markers', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-markers.png', { timeout: 2_000 })
// })

// test('S2->Markers->Default', async ({ page }) => {
//   await page.goto('/s2/markers', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-markers.png', { timeout: 2_000 })
// })

// test('WM->Markers->WebGL', async ({ page }) => {
//   await page.goto('/wm/markers/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-markers-webgl.png', { timeout: 2_000 })
// })

// test('S2->Markers->WebGL', async ({ page }) => {
//   await page.goto('/s2/markers/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-markers-webgl.png', { timeout: 2_000 })
// })

// test('WM->Markers->WebGL2', async ({ page }) => {
//   await page.goto('/wm/markers/webgl2', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('wm-markers-webgl2.png', { timeout: 2_000 })
// })

// test('S2->Markers->WebGL2', async ({ page }) => {
//   await page.goto('/s2/markers/webgl2', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-markers-webgl2.png', { timeout: 2_000 })
// })

// test('WM->Markers->WebGPU', async ({ page, browserName }) => {
//   await page.goto('/wm/markers/webgpu', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   const evaluation = await page.evaluate(waitMap)
//   // expect webkit and firefox to fail
//   expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
//   await expect(page).toHaveScreenshot('wm-markers-webgpu.png', { timeout: 2_000 })
// })

// test('S2->Markers->WebGPU', async ({ page, browserName }) => {
//   await page.goto('/s2/markers/webgpu', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   const evaluation = await page.evaluate(waitMap)
//   // expect webkit and firefox to fail
//   expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
//   await expect(page).toHaveScreenshot('s2-markers-webgpu.png', { timeout: 2_000 })
// })
