import { convertMaplibreStyle } from './convertMaplibreStyle.js';

import type { MapOptions as MaplibreMapOptions } from 'maplibre-gl';
import type { MapOptions, View } from 's2/index.js';

/**
 * Convert Maplibre `MapOptions` to S2 {@link MapOptions}
 *
 * ex.
 * ```ts
 * import { convertMaplibreOptions } from 's2maps-gpu/plugins';
 * import type { MapOptions as MaplibreMapOptions } from 'maplibre-gl';
 * // setup maplibre options
 * const maplibreOptions: MaplibreMapOptions = { ... };
 * // convert to s2maps options
 * const s2mapsOptions = convertMaplibreOptions(maplibreOptions);
 * // create a map with it
 * const map = new S2Map(s2mapsOptions);
 * ```
 * @param input - the Maplibre options
 * @returns the S2 options
 */
export function convertMaplibreOptions(input: MaplibreMapOptions): MapOptions {
  const {
    hash,
    interactive,
    container,
    // bearingSnap,
    // attributionControl,
    maplibreLogo,
    // logoPosition,
    // canvasContextAttributes,
    // refreshExpiredTiles,
    // maxBounds,
    scrollZoom,
    minZoom,
    maxZoom,
    // minPitch,
    // maxPitch,
    // boxZoom,
    // dragRotate,
    // dragPan,
    // keyboard,
    // doubleClickZoom,
    // touchZoomRotate,
    // touchPitch,
    // cooperativeGestures,
    // trackResize,
    center,
    // elevation,
    zoom,
    bearing,
    pitch,
    // roll,
    // renderWorldCopies,
    // maxTileCacheSize,
    // maxTileCacheZoomLevels,
    // transformRequest,
    // transformCameraUpdate,
    // locale,
    // fadeDuration,
    // crossSourceCollisions,
    // collectResourceTiming,
    // clickTolerance,
    // bounds,
    // fitBoundsOptions,
    // localIdeographFontFamily,
    style,
    // pitchWithRotate,
    // rollEnabled,
    // pixelRatio,
    // validateStyle,
    // maxCanvasSize,
    // cancelPendingTileRequestsWhileZooming,
    // centerClampedToGround,
  } = input;

  const convertedStyle =
    typeof style === 'string' ? style : style !== undefined ? convertMaplibreStyle(style) : {};

  if (typeof convertedStyle === 'object') {
    if (minZoom !== null) convertedStyle.minzoom = minZoom;
    if (maxZoom !== null) convertedStyle.maxzoom = maxZoom;
    const view: View = {};
    view.bearing = bearing;
    view.pitch = pitch;
    view.zoom = zoom;
    if (Array.isArray(center)) {
      view.lon = center[0];
      view.lat = center[1];
    } else if (typeof center === 'object') {
      if ('lon' in center) view.lon = center.lon;
      if ('lng' in center) view.lon = center.lng;
      if ('lat' in center) view.lat = center.lat;
    }
    convertedStyle.view = view;
  }

  return {
    hash: typeof hash === 'boolean' ? hash : false,
    canZoom: typeof scrollZoom === 'boolean' ? scrollZoom : true,
    interactive,
    style: convertedStyle,
    container,
    attributionOff: maplibreLogo,
  };
}
