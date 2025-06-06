import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Fill Pattern',
  view: {
    lon: 0,
    lat: 0,
    zoom: -0.5,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: 'dataURL://geojson/land.geojson',
  },
  images: {
    pattern: 'dataURL://images/pattern.jpg',
  },
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      pattern: 'pattern',
      patternMovement: true,
      color: '#b4c1c6',
    },
  ],
};

export default style;
