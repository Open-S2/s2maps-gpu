import S2BackgroundStyle from '../../pages/s2/background/style.js';
import S2FillStyle from '../../pages/s2/fill/style.js';
import S2MapGPU from '../components/S2MapGPU.vue';
import { expect, test } from '@playwright/experimental-ct-vue';
import { storeCoverage, waitMap } from './util.js';

import type { Page } from '@playwright/test';
import type { GPUType, StyleDefinition } from 's2/index.js';

/** Simulated component */
interface ComponentFixtures {
  page: Page;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mount: any;
  browserName: 'chromium' | 'firefox' | 'webkit';
}

// WebGPU //

test('S2->Background->WebGPU', testRender('s2-background-webgpu.png', S2BackgroundStyle, 3));
test('S2->Fill->WebGPU', testRender('s2-fill-webgpu.png', S2FillStyle, 3));

/**
 * Render test
 * @param screenshotName - name of the screenshot
 * @param style - S2 Map Style
 * @param contextType - GPU Type (1 = WebGL, 2 = WebGL2, 3 = WebGPU)
 * @returns a Playwright test function
 */
function testRender(
  screenshotName: string,
  style: StyleDefinition,
  contextType: GPUType,
): (context: ComponentFixtures) => Promise<void> {
  return async ({ page, mount, browserName }): Promise<void> => {
    const isChromium = browserName === 'chromium';
    test.skip(!isChromium && contextType === 3, 'WebGPU not supported outside of Chromium');
    const offscreen = browserName !== 'webkit';
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style, contextType, offscreen } },
    });
    if (isChromium) await page.coverage.startJSCoverage();
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const success = await page.evaluate(waitMap);
    if (!success) throw new Error('waitMap failed');
    if (isChromium) {
      const coverage = await page.coverage.stopJSCoverage();
      await storeCoverage(coverage);
    }
    await expect(component).toHaveScreenshot(screenshotName, { timeout: 2_000 });
  };
}
