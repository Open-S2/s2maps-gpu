import S2MapGPU from '../components/S2MapGPU.vue';
import S2Style from '../../pages/s2/fill/style.js';
import WMStyle from '../../pages/wm/fill/style.js';
import { waitMap } from './util.js';
import { expect, test } from '@playwright/experimental-ct-vue';

test.describe('Fill', () => {
  test('S2->Fill->Default', async ({ page, mount }) => {
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: S2Style } },
    });
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const success = await page.evaluate(waitMap);
    if (!success) throw new Error('waitMap failed');
    await expect(component).toHaveScreenshot('s2-fill.png', { timeout: 2_000 });
  });

  test('WM->Fill->Default', async ({ page, mount }) => {
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style: WMStyle } },
    });
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const success = await page.evaluate(waitMap);
    if (!success) throw new Error('waitMap failed');
    await expect(component).toHaveScreenshot('wm-fill.png', { timeout: 2_000 });
  });
});
