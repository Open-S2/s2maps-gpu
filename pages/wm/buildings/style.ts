import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WG',
  name: 'WM GeoJSON',
  view: {
    // lon:   Location SALT LAKE CITY    Latitude  40.76078000    Longitude  -111.89105000  ,
    lon: -111.89105,
    lat: 40.76078,
    zoom: 13,
  },
  minzoom: 0,
  maxzoom: 14,
  sources: {
    land: '/geojson/land.geojson',
    utah: '/geojson/utah.geojson',
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
      name: 'utah-fill',
      source: 'utah',
      type: 'fill',
      color: '#007bfe',
    },
  ],
};

export default style;
