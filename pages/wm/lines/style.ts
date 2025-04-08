import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  projection: 'WG',
  name: 'WM Lines',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.95,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: '/geojson/land.geojson',
    boundaries: '/geojson/boundaries.geojson',
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'country-line',
      source: 'boundaries',
      type: 'line',
      color: '#bbd3de',
      width: 1.85,
    },
  ],
};

export default style;
