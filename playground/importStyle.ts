// S2
import S2BackgroundStyle from '../styles/examples/s2/background/style.js';
import S2FillPatternSpriteStyle from '../styles/examples/s2/fill-pattern-sprite/style.js';
import S2FillPatternStyle from '../styles/examples/s2/fill-pattern/style.js';
import S2FillStyle from '../styles/examples/s2/fill/style.js';
import S2GlyphIconPair from '../styles/examples/s2/glyph-icon-pair/style.js';
import S2Glyphs from '../styles/examples/s2/glyphs/style.js';
import S2GlyphsInteractive from '../styles/examples/s2/glyphs-interactive/style.js';
import S2GlyphsPathsLine from '../styles/examples/s2/glyphs-paths/line/style.js';
import S2GlyphsPathsLineCenterPath from '../styles/examples/s2/glyphs-paths/line-center-path/style.js';
import S2GlyphsPathsLineCenterPoint from '../styles/examples/s2/glyphs-paths/line-center-point/style.js';
import S2GlyphsPathsPoint from '../styles/examples/s2/glyphs-paths/point/style.js';
import S2GlyphsSubstitute from '../styles/examples/s2/glyphs-substitute/style.js';
import S2HeatmapStyle from '../styles/examples/s2/heatmap/style.js';
import S2InvertPatternStyle from '../styles/examples/s2/invert-pattern/style.js';
import S2InvertStyle from '../styles/examples/s2/invert/style.js';
import S2LCHStyle from '../styles/examples/s2/lch/style.js';
import S2LinesStyle from '../styles/examples/s2/lines/style.js';
import S2LocalStyle from '../styles/examples/s2/local/style.js';
import S2MarkersStyle from '../styles/examples/s2/markers/style.js';
import S2NestedPropertiesStyle from '../styles/examples/s2/nested-properties/style.js';
import S2PointsStyle from '../styles/examples/s2/points/style.js';
import S2RasterStyle from '../styles/examples/s2/raster/style.js';
import S2S2JSONStyle from '../styles/examples/s2/s2json/style.js';
import S2ShadeStyle from '../styles/examples/s2/shade/style.js';
import S2SkyboxStyle from '../styles/examples/s2/skybox/style.js';
import S2SpritesStyle from '../styles/examples/s2/sprites/style.js';
import S2StreetsStyle from '../styles/examples/s2/streets/style.js';
import S2WallpaperStyle from '../styles/examples/s2/wallpaper/style.js';
// WM
import WMBackgroundStyle from '../styles/examples/wm/background/style.js';
import WMFillPatternSpriteStyle from '../styles/examples/wm/fill-pattern-sprite/style.js';
import WMFillPatternStyle from '../styles/examples/wm/fill-pattern/style.js';
import WMFillStyle from '../styles/examples/wm/fill/style.js';
import WMGeoJSONStyle from '../styles/examples/wm/geojson/style.js';
import WMGlyphIconPair from '../styles/examples/wm/glyph-icon-pair/style.js';
import WMGlyphs from '../styles/examples/wm/glyphs/style.js';
import WMHeatmapStyle from '../styles/examples/wm/heatmap/style.js';
import WMHillshadeStyle from '../styles/examples/wm/hillshade/style.js';
import WMHillshadeTerrariumStyle from '../styles/examples/wm/hillshade-terrarium/style.js';
import WMInvertPatternStyle from '../styles/examples/wm/invert-pattern/style.js';
import WMInvertStyle from '../styles/examples/wm/invert/style.js';
import WMLCHStyle from '../styles/examples/wm/lch/style.js';
import WMLinesStyle from '../styles/examples/wm/lines/style.js';
import WMLocalStyle from '../styles/examples/wm/local/style.js';
import WMMarkersStyle from '../styles/examples/wm/markers/style.js';
import WMNestedPropertiesStyle from '../styles/examples/wm/nested-properties/style.js';
import WMPointsStyle from '../styles/examples/wm/points/style.js';
import WMRasterStyle from '../styles/examples/wm/raster/style.js';
import WMSpritesStyle from '../styles/examples/wm/sprites/style.js';

import type { Projection, StyleDefinition } from 's2';

/**
 * Given a projection and a style name, import the style
 * @param projection - the projection
 * @param name - the name of the style
 * @returns the style if it exists
 */
export function importStyle(projection: Projection, name: string): StyleDefinition {
  if (projection === 'S2') {
    if (name === 'background') {
      return S2BackgroundStyle;
    } else if (name === 'fill-pattern-sprite') {
      return S2FillPatternSpriteStyle;
    } else if (name === 'fill-pattern') {
      return S2FillPatternStyle;
    } else if (name === 'fill') {
      return S2FillStyle;
    } else if (name === 'glyph-icon-pair') {
      return S2GlyphIconPair;
    } else if (name === 'glyphs') {
      return S2Glyphs;
    } else if (name === 'glyphs-interactive') {
      return S2GlyphsInteractive;
    } else if (name === 'glyphs-paths-line') {
      return S2GlyphsPathsLine;
    } else if (name === 'glyphs-paths-line-center-path') {
      return S2GlyphsPathsLineCenterPath;
    } else if (name === 'glyphs-paths-line-center-point') {
      return S2GlyphsPathsLineCenterPoint;
    } else if (name === 'glyphs-paths-point') {
      return S2GlyphsPathsPoint;
    } else if (name === 'glyphs-substitute') {
      return S2GlyphsSubstitute;
    } else if (name === 'heatmap') {
      return S2HeatmapStyle;
    } else if (name === 'invert-pattern') {
      return S2InvertPatternStyle;
    } else if (name === 'invert') {
      return S2InvertStyle;
    } else if (name === 'lch') {
      return S2LCHStyle;
    } else if (name === 'lines') {
      return S2LinesStyle;
    } else if (name === 'local') {
      return S2LocalStyle;
    } else if (name === 'markers') {
      return S2MarkersStyle;
    } else if (name === 'nested-properties') {
      return S2NestedPropertiesStyle;
    } else if (name === 'points') {
      return S2PointsStyle;
    } else if (name === 'raster') {
      return S2RasterStyle;
    } else if (name === 's2json') {
      return S2S2JSONStyle;
    } else if (name === 'shade') {
      return S2ShadeStyle;
    } else if (name === 'skybox') {
      return S2SkyboxStyle;
    } else if (name === 'sprites') {
      return S2SpritesStyle;
    } else if (name === 'streets') {
      return S2StreetsStyle;
    } else if (name === 'wallpaper') {
      return S2WallpaperStyle;
    }
  } else if (projection === 'WM') {
    if (name === 'background') {
      return WMBackgroundStyle;
    } else if (name === 'fill-pattern-sprite') {
      return WMFillPatternSpriteStyle;
    } else if (name === 'fill-pattern') {
      return WMFillPatternStyle;
    } else if (name === 'fill') {
      return WMFillStyle;
    } else if (name === 'geojson') {
      return WMGeoJSONStyle;
    } else if (name === 'glyph-icon-pair') {
      return WMGlyphIconPair;
    } else if (name === 'glyphs') {
      return WMGlyphs;
    } else if (name === 'heatmap') {
      return WMHeatmapStyle;
    } else if (name === 'hillshade') {
      return WMHillshadeStyle;
    } else if (name === 'hillshade-terrarium') {
      return WMHillshadeTerrariumStyle;
    } else if (name === 'invert-pattern') {
      return WMInvertPatternStyle;
    } else if (name === 'invert') {
      return WMInvertStyle;
    } else if (name === 'lch') {
      return WMLCHStyle;
    } else if (name === 'lines') {
      return WMLinesStyle;
    } else if (name === 'local') {
      return WMLocalStyle;
    } else if (name === 'markers') {
      return WMMarkersStyle;
    } else if (name === 'nested-properties') {
      return WMNestedPropertiesStyle;
    } else if (name === 'points') {
      return WMPointsStyle;
    } else if (name === 'raster') {
      return WMRasterStyle;
    } else if (name === 'sprites') {
      return WMSpritesStyle;
    }
  }
  throw new Error(`Unknown projection ${projection} or style ${name}`);
}
