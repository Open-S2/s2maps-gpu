import S2MapGPU from '../components/S2MapGPU.vue';
import { expect, test } from '@playwright/experimental-ct-vue';

import { collectCoverage, storeCoverage, waitMap } from './util.js';

import type { Page } from '@playwright/test';
import type { GPUType, StyleDefinition } from 's2/index.js';

/** Simulated component */
interface ComponentFixtures {
  page: Page;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mount: any;
  browserName: 'chromium' | 'firefox' | 'webkit';
}

// S2
import S2BackgroundStyle from '../../pages/s2/background/style.js';
import S2FillPatternSpriteStyle from '../../pages/s2/fill-pattern-sprite/style.js';
import S2FillPatternStyle from '../../pages/s2/fill-pattern/style.js';
import S2FillStyle from '../../pages/s2/fill/style.js';
// import S2HeatmapStyle from '../../pages/s2/heatmap/style.js';
// import S2InvertPatternStyle from '../../pages/s2/invert-pattern/style.js';
import S2InvertStyle from '../../pages/s2/invert/style.js';
// import S2LCHStyle from '../../pages/s2/lch/style.js';
import S2LinesStyle from '../../pages/s2/lines/style.js';
import S2LocalStyle from '../../pages/s2/local/style.js';
import S2MarkersStyle from '../../pages/s2/markers/style.js';
import S2NestedPropertiesStyle from '../../pages/s2/nested-properties/style.js';
import S2PointsStyle from '../../pages/s2/points/style.js';
import S2RasterStyle from '../../pages/s2/raster/style.js';
import S2S2JSONStyle from '../../pages/s2/s2json/style.js';
import S2ShadeStyle from '../../pages/s2/shade/style.js';
import S2SkyboxStyle from '../../pages/s2/skybox/style.js';
// import S2SpritesStyle from '../../pages/s2/sprites/style.js';
// import S2StreetsStyle from '../../pages/s2/streets/style.js';
import S2WallpaperStyle from '../../pages/s2/wallpaper/style.js';
// WM
import WMBackgroundStyle from '../../pages/wm/background/style.js';
import WMFillPatternSpriteStyle from '../../pages/wm/fill-pattern-sprite/style.js';
// import WMFillPatternStyle from '../../pages/wm/fill-pattern/style.js';
import WMFillStyle from '../../pages/wm/fill/style.js';
import WMGeoJSONStyle from '../../pages/wm/geojson/style.js';
import WMHeatmapStyle from '../../pages/wm/heatmap/style.js';
import WMHillshadeStyle from '../../pages/wm/hillshade/style.js';
import WMHillshadeTerrariumStyle from '../../pages/wm/hillshade-terrarium/style.js';
// import WMInvertPatternStyle from '../../pages/wm/invert-pattern/style.js';
import WMInvertStyle from '../../pages/wm/invert/style.js';
import WMLCHStyle from '../../pages/wm/lch/style.js';
import WMLinesStyle from '../../pages/wm/lines/style.js';
import WMLocalStyle from '../../pages/wm/local/style.js';
import WMMarkersStyle from '../../pages/wm/markers/style.js';
import WMNestedPropertiesStyle from '../../pages/wm/nested-properties/style.js';
import WMPointsStyle from '../../pages/wm/points/style.js';
import WMRasterStyle from '../../pages/wm/raster/style.js';
// import WMSpritesStyle from '../../pages/wm/sprites/style.js';

// WebGL2 //

// S2
test('S2->Background->WebGL2', testRender('s2-background-webgl2.png', S2BackgroundStyle, 2));
test('S2->Fill->WebGL2', testRender('s2-fill-webgl2.png', S2FillStyle, 2));
test('S2->Fill-Pattern->WebGL2', testRender('s2-fill-pattern-webgl2.png', S2FillPatternStyle, 2));
test(
  'S2->Fill-Pattern-Sprite->WebGL2',
  testRender('s2-fill-pattern-sprite-webgl2.png', S2FillPatternSpriteStyle, 2),
);
// test('S2->Heatmap->WebGL2', testRender('s2-heatmap-webgl2.png', S2HeatmapStyle, 2));
test('S2->Invert->WebGL2', testRender('s2-invert-webgl2.png', S2InvertStyle, 2));
// test(
//   'S2->Invert-Pattern->WebGL2',
//   testRender('s2-invert-pattern-webgl2.png', S2InvertPatternStyle, 2),
// );
// test('S2->LCH->WebGL2', testRender('s2-lch-webgl2.png', S2LCHStyle, 2));
test('S2->Lines->WebGL2', testRender('s2-lines-webgl2.png', S2LinesStyle, 2));
test('S2->Local->WebGL2', testRender('s2-local-webgl2.png', S2LocalStyle, 2));
test('S2->Markers->WebGL2', testRender('s2-markers-webgl2.png', S2MarkersStyle, 2));
test(
  'S2->Nested-Properties->WebGL2',
  testRender('s2-nested-properties-webgl2.png', S2NestedPropertiesStyle, 2),
);
test('S2->Points->WebGL2', testRender('s2-points-webgl2.png', S2PointsStyle, 2));
test('S2->Raster->WebGL2', testRender('s2-raster-webgl2.png', S2RasterStyle, 2));
test('S2->S2JSON->WebGL2', testRender('s2-s2json-webgl2.png', S2S2JSONStyle, 2));
test('S2->Shade->WebGL2', testRender('s2-shade-webgl2.png', S2ShadeStyle, 2));
test('S2->Skybox->WebGL2', testRender('s2-skybox-webgl2.png', S2SkyboxStyle, 2));
// test('S2->Sprites->WebGL2', testRender('s2-sprites-webgl2.png', S2SpritesStyle, 2));
// test('S2->Streets->WebGL2', testRender('s2-streets-webgl2.png', S2StreetsStyle, 2));
test('S2->Wallpaper->WebGL2', testRender('s2-wallpaper-webgl2.png', S2WallpaperStyle, 2));
// WM
test('WM->Background->WebGL2', testRender('wm-background-webgl2.png', WMBackgroundStyle, 2));
test('WM->Fill->WebGL2', testRender('wm-fill-webgl2.png', WMFillStyle, 2));
test('WM->GeoJSON->WebGL2', testRender('wm-geojson-webgl2.png', WMGeoJSONStyle, 2));
// test('WM->Fill-Pattern->WebGL2', testRender('wm-fill-pattern-webgl2.png', WMFillPatternStyle, 2));
test(
  'WM->Fill-Pattern-Sprite->WebGL2',
  testRender('wm-fill-pattern-sprite-webgl2.png', WMFillPatternSpriteStyle, 2),
);
test('WM->Heatmap->WebGL2', testRender('wm-heatmap-webgl2.png', WMHeatmapStyle, 2));
test('WM->Hillshade->WebGL2', testRender('wm-hillshade-webgl2.png', WMHillshadeStyle, 2));

test(
  'WM->HillshadeTerrarium->WebGL2',
  testRender('wm-hillshade-terrarium-webgl2.png', WMHillshadeTerrariumStyle, 2),
);
test('WM->Invert->WebGL2', testRender('wm-invert-webgl2.png', WMInvertStyle, 2));
// test(
//   'WM->Invert-Pattern->WebGL2',
//   testRender('wm-invert-pattern-webgl2.png', WMInvertPatternStyle, 2),
// );
test('WM->LCH->WebGL2', testRender('wm-lch-webgl2.png', WMLCHStyle, 2));
test('WM->Lines->WebGL2', testRender('wm-lines-webgl2.png', WMLinesStyle, 2));
test('WM->Local->WebGL2', testRender('wm-local-webgl2.png', WMLocalStyle, 2));
test('WM->Markers->WebGL2', testRender('wm-markers-webgl2.png', WMMarkersStyle, 2));
test(
  'WM->Nested-Properties->WebGL2',
  testRender('wm-nested-properties-webgl2.png', WMNestedPropertiesStyle, 2),
);
test('WM->Points->WebGL2', testRender('wm-points-webgl2.png', WMPointsStyle, 2));
test('WM->Raster->WebGL2', testRender('wm-raster-webgl2.png', WMRasterStyle, 2));
// test('WM->Sprites->WebGL2', testRender('wm-sprites-webgl2.png', WMSpritesStyle, 2));

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (context: ComponentFixtures & { context: any }) => Promise<void> {
  return async ({ page, mount, browserName, context }): Promise<void> => {
    const isChromium = browserName === 'chromium';
    test.skip(!isChromium && contextType === 3, 'WebGPU not supported outside of Chromium');
    const offscreen = browserName !== 'webkit';
    if (isChromium) await context.exposeFunction('collectCoverage', collectCoverage);
    const component = await mount(S2MapGPU, {
      props: { mapOptions: { style, contextType, offscreen } },
    });
    // if (isChromium) await page.coverage.startJSCoverage();
    await page.waitForFunction(() => window.testMap !== undefined, { timeout: 5_000 });
    const _success = await page.evaluate(waitMap);
    // if (!success) throw new Error('waitMap failed');
    if (isChromium) {
      // const coverage = await page.coverage.stopJSCoverage();
      // await storeCoverage(coverage);
      await page.evaluate(storeCoverage);
    }
    await expect(component).toHaveScreenshot(screenshotName, { timeout: 2_000 });
  };
}
