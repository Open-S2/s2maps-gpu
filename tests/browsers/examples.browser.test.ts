import S2MapGPU from '../../components/S2MapGPUTest.vue';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-vue';
import { waitMap } from './util.js';
import { expect, test } from 'vitest';

import S2BackgroundStyle from '../../pages/s2/background/style.js';
import S2FillStyle from '../../pages/s2/fill/style.js';

import type { GPUType, StyleDefinition } from 's2/index.js';

// WebGPU //

/**
 * Render test
 * @param snapshotName - name of the snapshot
 * @param style - S2 Map Style
 * @param contextType - GPU Type (1 = WebGL, 2 = WebGL2, 3 = WebGPU)
 * @returns a Vitest-compatible test function
 */
function testRender(snapshotName: string, style: StyleDefinition, contextType: GPUType) {
  return async () => {
    await page.viewport(1920, 1080);

    render(S2MapGPU, {
      props: { mapOptions: { style, contextType } },
    });

    while (typeof window.testMap === 'undefined') {
      await new Promise((r) => setTimeout(r, 50));
    }

    const success = await waitMap();
    expect(success).toBe(true);

    const screen = await page.screenshot();
    expect(screen).toMatchSnapshot(snapshotName);
  };
}

test('S2->Background->WebGPU', testRender('S2-Background-WebGPU', S2BackgroundStyle, 3));
test('S2->Fill->WebGPU', testRender('S2-Fill-WebGPU', S2FillStyle, 3));

// /**
//  * Render test
//  * @param snapshotName - name of the snapshot
//  * @param style - S2 Map Style
//  * @param contextType - GPU Type (1 = WebGL, 2 = WebGL2, 3 = WebGPU)
//  * @returns a Vitest test function
//  */
// async function testRender(
//   snapshotName: string,
//   style: StyleDefinition,
//   contextType: GPUType,
// ): Promise<TestFunction<undefined>> {
//   return await (async () => {
//     await page.viewport(1920, 1080);

//     render(S2MapGPU, {
//       props: { mapOptions: { style, contextType } },
//     });

//     // Wait until the map is available on the window
//     while (typeof window.testMap === 'undefined') {
//       await new Promise((r) => setTimeout(r, 50));
//     }

//     // Wait for the map to be fully rendered
//     const success = await waitMap();
//     expect(success).toBe(true);

//     const screen = await page.screenshot();
//     expect(screen).toMatchSnapshot(snapshotName);
//   });
// }
