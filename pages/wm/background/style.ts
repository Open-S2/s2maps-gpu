import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  projection: 'WG',
  name: 'WM Background',
  view: {
    lon: 0,
    lat: 0,
    zoom: -0.5,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {},
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#b4c1c6',
    },
  ],
};

export default style;
