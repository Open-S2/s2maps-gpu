import S2MapGPU from '../components/S2MapGPU.vue';
import S2Style from '../../pages/s2/background/style';
import WMStyle from '../../pages/wm/background/style';
import { waitMap } from './util';
import { expect, test } from '@playwright/experimental-ct-vue';

test.describe('Background', () => {
  test('S2->Background->Default', async ({ page, mount }) => {
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: S2Style } },
    });
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    await page.evaluate(waitMap);
    await expect(component).toHaveScreenshot('s2-background.png', { timeout: 2_000 });
  });

  test('WM->Background->Default', async ({ page, mount }) => {
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: WMStyle } },
    });
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    await page.evaluate(waitMap);
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
