import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'WM PMTiles',
  projection: 'WG',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 12,
  sources: {
    land: '/geojson/land.geojson',
    zipcodes: '/pmtiles/cb_2018_us_zcta510_500k_nolimit.pmtiles',
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
      name: 'zipcodes-lines',
      source: 'zipcodes',
      layer: 'zcta',
      type: 'line',
      width: 1,
      color: 'red',
    },
  ],
};

export default style;
