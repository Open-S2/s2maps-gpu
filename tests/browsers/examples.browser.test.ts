import S2MapGPU from './S2MapGPUTest.vue';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-vue';
import { waitMap } from './util.js';
import { describe, expect, test } from 'vitest';
// styles
// S2
import S2BackgroundStyle from '../../styles/examples/s2/background/style.js';
import S2FillPatternSpriteStyle from '../../styles/examples/s2/fill-pattern-sprite/style.js';
import S2FillPatternStyle from '../../styles/examples/s2/fill-pattern/style.js';
import S2FillStyle from '../../styles/examples/s2/fill/style.js';
import S2HeatmapStyle from '../../styles/examples/s2/heatmap/style.js';
import S2InvertPatternStyle from '../../styles/examples/s2/invert-pattern/style.js';
import S2InvertStyle from '../../styles/examples/s2/invert/style.js';
import S2LCHStyle from '../../styles/examples/s2/lch/style.js';
import S2LinesStyle from '../../styles/examples/s2/lines/style.js';
import S2LocalStyle from '../../styles/examples/s2/local/style.js';
import S2MarkersStyle from '../../styles/examples/s2/markers/style.js';
import S2NestedPropertiesStyle from '../../styles/examples/s2/nested-properties/style.js';
import S2PointsStyle from '../../styles/examples/s2/points/style.js';
import S2RasterStyle from '../../styles/examples/s2/raster/style.js';
import S2S2JSONStyle from '../../styles/examples/s2/s2json/style.js';
import S2ShadeStyle from '../../styles/examples/s2/shade/style.js';
import S2SkyboxStyle from '../../styles/examples/s2/skybox/style.js';
// import S2SpritesStyle from '../../styles/examples/s2/sprites/style.js';
// import S2StreetsStyle from '../../styles/examples/s2/streets/style.js';
import S2WallpaperStyle from '../../styles/examples/s2/wallpaper/style.js';
// WM
import WMBackgroundStyle from '../../styles/examples/wm/background/style.js';
import WMFillPatternSpriteStyle from '../../styles/examples/wm/fill-pattern-sprite/style.js';
import WMFillPatternStyle from '../../styles/examples/wm/fill-pattern/style.js';
import WMFillStyle from '../../styles/examples/wm/fill/style.js';
import WMGeoJSONStyle from '../../styles/examples/wm/geojson/style.js';
import WMHeatmapStyle from '../../styles/examples/wm/heatmap/style.js';
import WMHillshadeStyle from '../../styles/examples/wm/hillshade/style.js';
import WMHillshadeTerrariumStyle from '../../styles/examples/wm/hillshade-terrarium/style.js';
import WMInvertPatternStyle from '../../styles/examples/wm/invert-pattern/style.js';
import WMInvertStyle from '../../styles/examples/wm/invert/style.js';
import WMLCHStyle from '../../styles/examples/wm/lch/style.js';
import WMLinesStyle from '../../styles/examples/wm/lines/style.js';
import WMLocalStyle from '../../styles/examples/wm/local/style.js';
import WMMarkersStyle from '../../styles/examples/wm/markers/style.js';
import WMNestedPropertiesStyle from '../../styles/examples/wm/nested-properties/style.js';
import WMPointsStyle from '../../styles/examples/wm/points/style.js';
import WMRasterStyle from '../../styles/examples/wm/raster/style.js';
// import WMSpritesStyle from '../../styles/examples/wm/sprites/style.js';

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

// describe('WebGPU', () => {
//   // S2
//   test('S2->Background->WebGPU', testRender('S2_Background_WebGPU', S2BackgroundStyle, 3));
//   test(
//     'S2->Fill-Pattern-Sprite->WebGPU',
//     testRender('S2_Fill_Pattern_Sprite_WebGPU', S2FillPatternSpriteStyle, 3),
//   );
//   test('S2->Fill-Pattern->WebGPU', testRender('S2_Fill_Pattern_WebGPU', S2FillPatternStyle, 3));
//   test('S2->Fill->WebGPU', testRender('S2_Fill_WebGPU', S2FillStyle, 3));
//   test('S2->Heatmap->WebGPU', testRender('S2_Heatmap_WebGPU', S2HeatmapStyle, 3));
//   test('S2->Invert->WebGPU', testRender('S2_Invert_WebGPU', S2InvertStyle, 3));
//   test(
//     'S2->Invert-Pattern->WebGPU',
//     testRender('S2_Invert_Pattern_WebGPU', S2InvertPatternStyle, 3),
//   );
//   test('S2->LCH->WebGPU', testRender('S2_LCH_WebGPU', S2LCHStyle, 3));
//   test('S2->Lines->WebGPU', testRender('S2_Lines_WebGPU', S2LinesStyle, 3));
//   test('S2->Local->WebGPU', testRender('S2_Local_WebGPU', S2LocalStyle, 3));
//   test('S2->Markers->WebGPU', testRender('S2_Markers_WebGPU', S2MarkersStyle, 3));
//   test(
//     'S2->Nested-Properties->WebGPU',
//     testRender('S2_Nested_Properties_WebGPU', S2NestedPropertiesStyle, 3),
//   );
//   test('S2->Points->WebGPU', testRender('S2_Points_WebGPU', S2PointsStyle, 3));
//   test('S2->Raster->WebGPU', testRender('S2_Raster_WebGPU', S2RasterStyle, 3));
//   test('S2->S2JSON->WebGPU', testRender('S2_S2JSON_WebGPU', S2S2JSONStyle, 3));
//   test('S2->Shade->WebGPU', testRender('S2_Shade_WebGPU', S2ShadeStyle, 3));
//   test('S2->Skybox->WebGPU', testRender('S2_Skybox_WebGPU', S2SkyboxStyle, 3));
//   // test('S2->Sprites->WebGPU', testRender('S2_Sprites_WebGPU', S2SpritesStyle, 3));
//   // test('S2->Streets->WebGPU', testRender('S2_Streets_WebGPU', S2StreetsStyle, 3));
//   test('S2->Wallpaper->WebGPU', testRender('S2_Wallpaper_WebGPU', S2WallpaperStyle, 3));
//   // WM
//   test('WM->Background->WebGPU', testRender('WM_Background_WebGPU', WMBackgroundStyle, 3));
//   test(
//     'WM->Fill-Pattern-Sprite->WebGPU',
//     testRender('WM_Fill_Pattern_Sprite_WebGPU', WMFillPatternSpriteStyle, 3),
//   );
//   test('WM->Fill-Pattern->WebGPU', testRender('WM_Fill_Pattern_WebGPU', WMFillPatternStyle, 3));
//   test('WM->Fill->WebGPU', testRender('WM_Fill_WebGPU', WMFillStyle, 3));
//   test('WM->GeoJSON->WebGPU', testRender('WM_GeoJSON_WebGPU', WMGeoJSONStyle, 3));
//   test('WM->Heatmap->WebGPU', testRender('WM_Heatmap_WebGPU', WMHeatmapStyle, 3));
//   test('WM->Hillshade->WebGPU', testRender('WM_Hillshade_WebGPU', WMHillshadeStyle, 3));
//   test(
//     'WM->HillshadeTerrarium->WebGPU',
//     testRender('WM_Hillshade_Terrarium_WebGPU', WMHillshadeTerrariumStyle, 3),
//   );
//   test('WM->Invert->WebGPU', testRender('WM_Invert_WebGPU', WMInvertStyle, 3));
//   test(
//     'WM->Invert-Pattern->WebGPU',
//     testRender('WM_Invert_Pattern_WebGPU', WMInvertPatternStyle, 3),
//   );
//   test('WM->LCH->WebGPU', testRender('WM_LCH_WebGPU', WMLCHStyle, 3));
//   test('WM->Lines->WebGPU', testRender('WM_Lines_WebGPU', WMLinesStyle, 3));
//   test('WM->Local->WebGPU', testRender('WM_Local_WebGPU', WMLocalStyle, 3));
//   test('WM->Markers->WebGPU', testRender('WM_Markers_WebGPU', WMMarkersStyle, 3));
//   test(
//     'WM->Nested-Properties->WebGPU',
//     testRender('WM_Nested_Properties_WebGPU', WMNestedPropertiesStyle, 3),
//   );
//   test('WM->Points->WebGPU', testRender('WM_Points_WebGPU', WMPointsStyle, 3));
//   test('WM->Raster->WebGPU', testRender('WM_Raster_WebGPU', WMRasterStyle, 3));
//   // test('WM->Sprites->WebGPU', testRender('WM_Sprites_WebGPU', WMSpritesStyle, 3));
// });
