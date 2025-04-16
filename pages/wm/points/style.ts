import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Points',
  projection: 'WG',
  view: {
    lon: 0,
    lat: 0,
    zoom: -0.5,
  },
  minzoom: -0.5,
  maxzoom: 5.5,
  sources: {
    land: '/geojson/land.geojson',
    ports: '/geojson/ports.geojson',
  },
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      color: '#b4c1c6',
    },
    {
      name: 'country-points',
      source: 'ports',
      type: 'point',
      color: '#007bfe',
      radius: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 3.5 },
            { stop: 2, input: 9 },
          ],
        },
      },
    },
  ],
};

export default style;
