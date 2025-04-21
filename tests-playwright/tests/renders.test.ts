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

// S2
import S2BackgroundStyle from '../../pages/s2/background/style.js';
import S2FillPatternSpriteStyle from '../../pages/s2/fill-pattern-sprite/style.js';
import S2FillPatternStyle from '../../pages/s2/fill-pattern/style.js';
import S2FillStyle from '../../pages/s2/fill/style.js';
import S2HeatmapStyle from '../../pages/s2/heatmap/style.js';
import S2InvertPatternStyle from '../../pages/s2/invert-pattern/style.js';
import S2InvertStyle from '../../pages/s2/invert/style.js';
import S2LCHStyle from '../../pages/s2/lch/style.js';
import S2LinesStyle from '../../pages/s2/lines/style.js';
import S2LocalStyle from '../../pages/s2/local/style.js';
import S2MarkersStyle from '../../pages/s2/markers/style.js';
import S2NestedPropertiesStyle from '../../pages/s2/nested-properties/style.js';
import S2PointsStyle from '../../pages/s2/points/style.js';
import S2RasterStyle from '../../pages/s2/raster/style.js';
import S2S2JSONStyle from '../../pages/s2/s2json/style.js';
import S2ShadeStyle from '../../pages/s2/shade/style.js';
import S2SkyboxStyle from '../../pages/s2/skybox/style.js';
import S2SpritesStyle from '../../pages/s2/sprites/style.js';
// import S2StreetsStyle from '../../pages/s2/streets/style.js';
import S2WallpaperStyle from '../../pages/s2/wallpaper/style.js';
// WM
import WMBackgroundStyle from '../../pages/wm/background/style.js';
import WMFillPatternSpriteStyle from '../../pages/wm/fill-pattern-sprite/style.js';
import WMFillPatternStyle from '../../pages/wm/fill-pattern/style.js';
import WMFillStyle from '../../pages/wm/fill/style.js';
import WMGeoJSONStyle from '../../pages/wm/geojson/style.js';
import WMHeatmapStyle from '../../pages/wm/heatmap/style.js';
import WMHillshadeStyle from '../../pages/wm/hillshade/style.js';
import WMHillshadeTerrariumStyle from '../../pages/wm/hillshade-terrarium/style.js';
import WMInvertPatternStyle from '../../pages/wm/invert-pattern/style.js';
import WMInvertStyle from '../../pages/wm/invert/style.js';
import WMLCHStyle from '../../pages/wm/lch/style.js';
import WMLinesStyle from '../../pages/wm/lines/style.js';
import WMLocalStyle from '../../pages/wm/local/style.js';
import WMMarkersStyle from '../../pages/wm/markers/style.js';
import WMNestedPropertiesStyle from '../../pages/wm/nested-properties/style.js';
import WMPointsStyle from '../../pages/wm/points/style.js';
import WMRasterStyle from '../../pages/wm/raster/style.js';
import WMSpritesStyle from '../../pages/wm/sprites/style.js';

// WebGPU //

// S2
test('S2->Background->WebGPU', testRender('s2-background-webgpu.png', S2BackgroundStyle, 3));
test('S2->Fill->WebGPU', testRender('s2-fill-webgpu.png', S2FillStyle, 3));
test('S2->Fill-Pattern->WebGPU', testRender('s2-fill-pattern-webgpu.png', S2FillPatternStyle, 3));
test(
  'S2->Fill-Pattern-Sprite->WebGPU',
  testRender('s2-fill-pattern-sprite-webgpu.png', S2FillPatternSpriteStyle, 3),
);
test('S2->Heatmap->WebGPU', testRender('s2-heatmap-webgpu.png', S2HeatmapStyle, 3));
test('S2->Invert->WebGPU', testRender('s2-invert-webgpu.png', S2InvertStyle, 3));
test(
  'S2->Invert-Pattern->WebGPU',
  testRender('s2-invert-pattern-webgpu.png', S2InvertPatternStyle, 3),
);
test('S2->LCH->WebGPU', testRender('s2-lch-webgpu.png', S2LCHStyle, 3));
test('S2->Lines->WebGPU', testRender('s2-lines-webgpu.png', S2LinesStyle, 3));
test('S2->Local->WebGPU', testRender('s2-local-webgpu.png', S2LocalStyle, 3));
test('S2->Markers->WebGPU', testRender('s2-markers-webgpu.png', S2MarkersStyle, 3));
test(
  'S2->Nested-Properties->WebGPU',
  testRender('s2-nested-properties-webgpu.png', S2NestedPropertiesStyle, 3),
);
test('S2->Points->WebGPU', testRender('s2-points-webgpu.png', S2PointsStyle, 3));
test('S2->Raster->WebGPU', testRender('s2-raster-webgpu.png', S2RasterStyle, 3));
test('S2->S2JSON->WebGPU', testRender('s2-s2json-webgpu.png', S2S2JSONStyle, 3));
test('S2->Shade->WebGPU', testRender('s2-shade-webgpu.png', S2ShadeStyle, 3));
test('S2->Skybox->WebGPU', testRender('s2-skybox-webgpu.png', S2SkyboxStyle, 3));
test('S2->Sprites->WebGPU', testRender('s2-sprites-webgpu.png', S2SpritesStyle, 3));
// test('S2->Streets->WebGPU', testRender('s2-streets-webgpu.png', S2StreetsStyle, 3));
test('S2->Wallpaper->WebGPU', testRender('s2-wallpaper-webgpu.png', S2WallpaperStyle, 3));
// WM
test('WM->Background->WebGPU', testRender('wm-background-webgpu.png', WMBackgroundStyle, 3));
test('WM->Fill->WebGPU', testRender('wm-fill-webgpu.png', WMFillStyle, 3));
test('WM->GeoJSON->WebGPU', testRender('wm-geojson-webgpu.png', WMGeoJSONStyle, 3));
test('WM->Fill-Pattern->WebGPU', testRender('wm-fill-pattern-webgpu.png', WMFillPatternStyle, 3));
test(
  'WM->Fill-Pattern-Sprite->WebGPU',
  testRender('wm-fill-pattern-sprite-webgpu.png', WMFillPatternSpriteStyle, 3),
);
test('WM->Heatmap->WebGPU', testRender('wm-heatmap-webgpu.png', WMHeatmapStyle, 3));
test('WM->Hillshade->WebGPU', testRender('wm-hillshade-webgpu.png', WMHillshadeStyle, 3));

test(
  'WM->HillshadeTerrarium->WebGPU',
  testRender('wm-hillshade-terrarium-webgpu.png', WMHillshadeTerrariumStyle, 3),
);
test('WM->Invert->WebGPU', testRender('wm-invert-webgpu.png', WMInvertStyle, 3));
test(
  'WM->Invert-Pattern->WebGPU',
  testRender('wm-invert-pattern-webgpu.png', WMInvertPatternStyle, 3),
);
test('WM->LCH->WebGPU', testRender('wm-lch-webgpu.png', WMLCHStyle, 3));
test('WM->Lines->WebGPU', testRender('wm-lines-webgpu.png', WMLinesStyle, 3));
test('WM->Local->WebGPU', testRender('wm-local-webgpu.png', WMLocalStyle, 3));
test('WM->Markers->WebGPU', testRender('wm-markers-webgpu.png', WMMarkersStyle, 3));
test(
  'WM->Nested-Properties->WebGPU',
  testRender('wm-nested-properties-webgpu.png', WMNestedPropertiesStyle, 3),
);
test('WM->Points->WebGPU', testRender('wm-points-webgpu.png', WMPointsStyle, 3));
test('WM->Raster->WebGPU', testRender('wm-raster-webgpu.png', WMRasterStyle, 3));
test('WM->Sprites->WebGPU', testRender('wm-sprites-webgpu.png', WMSpritesStyle, 3));

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
