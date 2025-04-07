import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Invert Pattern',
  view: {
    lon: 0,
    lat: 0,
    zoom: 2,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: '/geojson/land.geojson',
  },
  images: {
    pattern: '/images/sea-pattern.jpg',
  },
  layers: [
    {
      name: 'water-invert',
      source: 'land',
      type: 'fill',
      pattern: 'pattern',
      patternMovement: true,
      invert: true,
      color: '#b4c1c6',
    },
  ],
};

export default style;
