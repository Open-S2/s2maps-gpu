// import { expect, test } from '@playwright/test'
// import { waitMap } from './util'

// test('S2->Skybox->Default', async ({ page }) => {
//   await page.goto('/s2/skybox', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-skybox.png', { timeout: 2_000 })
// })

// test('S2->Skybox->WebGL', async ({ page }) => {
//   await page.goto('/s2/skybox/webgl', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-skybox-webgl.png', { timeout: 2_000 })
// })

// test('S2->Skybox->WebGL2', async ({ page }) => {
//   await page.goto('/s2/skybox/webgl2', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   await page.evaluate(waitMap)
//   await expect(page).toHaveScreenshot('s2-skybox-webgl2.png', { timeout: 2_000 })
// })

// test('S2->Skybox->WebGPU', async ({ page, browserName }) => {
//   await page.goto('/s2/skybox/webgpu', { waitUntil: 'domcontentloaded' })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 7_000 })
//   const evaluation = await page.evaluate(waitMap)
//   // expect webkit and firefox to fail
//   expect(evaluation).toBe(!(browserName === 'webkit' || browserName === 'firefox'))
//   await expect(page).toHaveScreenshot('s2-skybox-webgpu.png', { timeout: 2_000 })
// })
