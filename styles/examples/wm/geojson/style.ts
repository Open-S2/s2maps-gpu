import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM GeoJSON',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.95,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: 'dataURL://geojson/land.geojson',
    usa: 'dataURL://geojson/usa.geojson',
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      color: '#b4c1c6',
    },
    {
      name: 'usa-fill',
      source: 'usa',
      type: 'fill',
      color: '#007bfe',
    },
  ],
};

export default style;
