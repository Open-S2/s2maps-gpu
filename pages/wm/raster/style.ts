import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Raster',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0,
  },
  minzoom: -0.5,
  maxzoom: 5.5,
  sources: {
    satellite: '/tiles/wm/satellite',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      color: '#ffffff',
    },
    {
      name: 'sat',
      source: 'satellite',
      type: 'raster',
    },
  ],
};

export default style;
