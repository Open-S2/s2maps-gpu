import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Dashed Lines',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.95,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: 'dataURL://geojson/land.geojson',
    boundaries: 'dataURL://geojson/boundaries.geojson',
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'country-line',
      source: 'boundaries',
      type: 'line',
      color: '#bbd3de',
      width: 2.75,
      dasharray: [
        [30, '#bbd3de'],
        [12, 'rgba(255, 255, 255, 0)'],
      ],
    },
  ],
};

export default style;
