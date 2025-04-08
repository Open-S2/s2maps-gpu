import S2MapGPU from '../components/S2MapGPU.vue';
import S2Style from '../../pages/s2/fill/style';
// import WMStyle from '../../pages/wm/fill/style'
import { waitMap } from './util';
import { expect, test } from '@playwright/experimental-ct-vue';

test('S2->Fill->Default', async ({ page, mount }) => {
  const component = await mount(S2MapGPU, {
    props: { mapOptions: { style: S2Style } },
  });
  await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
  await page.evaluate(waitMap);
  await expect(component).toHaveScreenshot('s2-background.png', { timeout: 2_000 });
});
