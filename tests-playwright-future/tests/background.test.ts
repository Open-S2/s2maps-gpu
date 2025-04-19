import S2MapGPU from '../components/S2MapGPU.vue';
import S2Style from '../../pages/s2/background/style.js';
import WMStyle from '../../pages/wm/background/style.js';
import { expect, test } from '@playwright/experimental-ct-vue';
import { storeCoverage, waitMap } from './util.js';

import v8toIstanbul from 'v8-to-istanbul';

test.describe('Background', () => {
  test('S2->Background->Default', async ({ page, mount, browser }) => {
    const isChromium = browser.browserType().name() === 'chromium';
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: S2Style } },
    });
    // https://playwright.dev/docs/api/class-coverage
    if (isChromium) await page.coverage.startJSCoverage();
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const success = await page.evaluate(waitMap);
    if (!success) throw new Error('waitMap failed');
    if (isChromium) {
      const coverage = await page.coverage.stopJSCoverage();
      for (const { source, functions } of coverage) {
        const converter = v8toIstanbul(
          './tests-playwright-future/playwright/.cache/assets/assets/',
          0,
          {
            source: source ?? '',
          },
        );
        await converter.load();
        converter.applyCoverage(functions);
        await storeCoverage(JSON.stringify(converter.toIstanbul()));
      }
    }
    await expect(component).toHaveScreenshot('s2-background.png', { timeout: 2_000 });
  });

  test('WM->Background->Default', async ({ page, mount }) => {
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: WMStyle } },
    });
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const success = await page.evaluate(waitMap);
    if (!success) throw new Error('waitMap failed');
    await expect(component).toHaveScreenshot('wm-background.png', { timeout: 2_000 });
  });
});

// test('S2->Background->WebGL', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: S2Style, contextType: 1 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('s2-background-webgl.png', { timeout: 2_000 })
// })

// test('WM->Background->WebGL', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: WMStyle, contextType: 1 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('wm-background-webgl.png', { timeout: 2_000 })
// })

// test('S2->Background->WebGL2', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: S2Style, contextType: 2 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('s2-background-webgl2.png', { timeout: 2_000 })
// })

// test('WM->Background->WebGL2', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: WMStyle, contextType: 2 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('wm-background-webgl2.png', { timeout: 2_000 })
// })

// test('S2->Background->WebGPU', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: S2Style, contextType: 3 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('s2-background-webgpu.png', { timeout: 2_000 })
// })

// test('WM->Background->WebGPU', async ({ page, mount }) => {
//   const component = await mount(S2MapGPU, {
//     props: { mapOptions: { style: WMStyle, contextType: 3 } }
//   })
//   await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 })
//   await page.evaluate(waitMap)
//   await expect(component).toHaveScreenshot('wm-background-webgpu.png', { timeout: 2_000 })
// })
