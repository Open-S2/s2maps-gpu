import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Fill Pattern using Sprites',
  projection: 'WG',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.5,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    land: '/geojson/land.geojson',
  },
  sprites: {
    streets: '/sprites/streets/sprite@2x',
  },
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      pattern: 'star_15',
      patternFamily: 'streets',
      patternMovement: true,
      color: '#b4c1c6',
    },
  ],
};

export default style;
