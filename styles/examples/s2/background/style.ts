import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Background',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {},
  fonts: {},
  layers: [
    {
      type: 'fill',
      name: 'background',
      source: 'mask',
      opaque: true,
      color: '#b4c1c6',
    },
  ],
};

export default style;
