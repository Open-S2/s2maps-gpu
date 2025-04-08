import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Local Source',
  projection: 'WG',
  view: {
    lon: 0,
    lat: 0,
    zoom: 2.5,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    land: '/geojson/land.geojson',
    local: '_local',
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
      name: 'local-line',
      source: 'local',
      layer: 'boundary',
      type: 'line',
      color: '#000000',
      width: 2.5,
    },
  ],
};

export default style;
