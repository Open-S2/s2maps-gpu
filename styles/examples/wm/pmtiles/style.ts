import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM PMTiles',
  projection: 'WM',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 12,
  sources: {
    land: 'dataURL://geojson/land.geojson',
    zipcodes: 'dataURL://pmtiles/cb_2018_us_zcta510_500k_nolimit.pmtiles',
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
