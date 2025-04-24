import S2MapGPU from '../../components/S2MapGPUTest.vue';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-vue';
import { waitMap } from './util.js';
import { describe, expect, test } from 'vitest';
// styles
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
// import S2SpritesStyle from '../../pages/s2/sprites/style.js';
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
// import WMSpritesStyle from '../../pages/wm/sprites/style.js';

import type { GPUType, StyleDefinition } from 's2/index.js';

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

    const comp = render(S2MapGPU, {
      props: { mapOptions: { style, contextType } },
    });

    while (typeof window.testMap === 'undefined') {
      await new Promise((r) => setTimeout(r, 50));
    }

    const success = await waitMap();
    expect(success).toBe(true);

    const content = await page.screenshot();
    expect(content).toMatchSnapshot(snapshotName);

    comp.unmount();
  };
}

describe('WebGL2', () => {
  // S2
  test('S2->Background->WebGL2', testRender('S2_Background_WebGL2', S2BackgroundStyle, 2));
  test(
    'S2->Fill-Pattern-Sprite->WebGL2',
    testRender('S2_Fill_Pattern_Sprite_WebGL2', S2FillPatternSpriteStyle, 2),
  );
  test('S2->Fill-Pattern->WebGL2', testRender('S2_Fill_Pattern_WebGL2', S2FillPatternStyle, 2));
  test('S2->Fill->WebGL2', testRender('S2_Fill_WebGL2', S2FillStyle, 2));
  test('S2->Heatmap->WebGL2', testRender('S2_Heatmap_WebGL2', S2HeatmapStyle, 2));
  test('S2->Invert->WebGL2', testRender('S2_Invert_WebGL2', S2InvertStyle, 2));
  test(
    'S2->Invert-Pattern->WebGL2',
    testRender('S2_Invert_Pattern_WebGL2', S2InvertPatternStyle, 2),
  );
  test('S2->LCH->WebGL2', testRender('S2_LCH_WebGL2', S2LCHStyle, 2));
  test('S2->Lines->WebGL2', testRender('S2_Lines_WebGL2', S2LinesStyle, 2));
  test('S2->Local->WebGL2', testRender('S2_Local_WebGL2', S2LocalStyle, 2));
  test('S2->Markers->WebGL2', testRender('S2_Markers_WebGL2', S2MarkersStyle, 2));
  test(
    'S2->Nested-Properties->WebGL2',
    testRender('S2_Nested_Properties_WebGL2', S2NestedPropertiesStyle, 2),
  );
  test('S2->Points->WebGL2', testRender('S2_Points_WebGL2', S2PointsStyle, 2));
  test('S2->Raster->WebGL2', testRender('S2_Raster_WebGL2', S2RasterStyle, 2));
  test('S2->S2JSON->WebGL2', testRender('S2_S2JSON_WebGL2', S2S2JSONStyle, 2));
  test('S2->Shade->WebGL2', testRender('S2_Shade_WebGL2', S2ShadeStyle, 2));
  test('S2->Skybox->WebGL2', testRender('S2_Skybox_WebGL2', S2SkyboxStyle, 2));
  // test('S2->Sprites->WebGL2', testRender('S2_Sprites_WebGL2', S2SpritesStyle, 2));
  // test('S2->Streets->WebGL2', testRender('S2_Streets_WebGL2', S2StreetsStyle, 2));
  test('S2->Wallpaper->WebGL2', testRender('S2_Wallpaper_WebGL2', S2WallpaperStyle, 2));
  // WM
  test('WM->Background->WebGL2', testRender('WM_Background_WebGL2', WMBackgroundStyle, 2));
  test(
    'WM->Fill-Pattern-Sprite->WebGL2',
    testRender('WM_Fill_Pattern_Sprite_WebGL2', WMFillPatternSpriteStyle, 2),
  );
  test('WM->Fill-Pattern->WebGL2', testRender('WM_Fill_Pattern_WebGL2', WMFillPatternStyle, 2));
  test('WM->Fill->WebGL2', testRender('WM_Fill_WebGL2', WMFillStyle, 2));
  test('WM->GeoJSON->WebGL2', testRender('WM_GeoJSON_WebGL2', WMGeoJSONStyle, 2));
  test('WM->Heatmap->WebGL2', testRender('WM_Heatmap_WebGL2', WMHeatmapStyle, 2));
  test('WM->Hillshade->WebGL2', testRender('WM_Hillshade_WebGL2', WMHillshadeStyle, 2));
  test(
    'WM->HillshadeTerrarium->WebGL2',
    testRender('WM_Hillshade_Terrarium_WebGL2', WMHillshadeTerrariumStyle, 2),
  );
  test('WM->Invert->WebGL2', testRender('WM_Invert_WebGL2', WMInvertStyle, 2));
  test(
    'WM->Invert-Pattern->WebGL2',
    testRender('WM_Invert_Pattern_WebGL2', WMInvertPatternStyle, 2),
  );
  test('WM->LCH->WebGL2', testRender('WM_LCH_WebGL2', WMLCHStyle, 2));
  test('WM->Lines->WebGL2', testRender('WM_Lines_WebGL2', WMLinesStyle, 2));
  test('WM->Local->WebGL2', testRender('WM_Local_WebGL2', WMLocalStyle, 2));
  test('WM->Markers->WebGL2', testRender('WM_Markers_WebGL2', WMMarkersStyle, 2));
  test(
    'WM->Nested-Properties->WebGL2',
    testRender('WM_Nested_Properties_WebGL2', WMNestedPropertiesStyle, 2),
  );
  test('WM->Points->WebGL2', testRender('WM_Points_WebGL2', WMPointsStyle, 2));
  test('WM->Raster->WebGL2', testRender('WM_Raster_WebGL2', WMRasterStyle, 2));
  // test('WM->Sprites->WebGL2', testRender('WM_Sprites_WebGL2', WMSpritesStyle, 2));
});
