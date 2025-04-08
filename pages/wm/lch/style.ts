import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  projection: 'WG',
  name: 'WM LCH',
  view: {
    lon: 0,
    lat: 0,
    zoom: 2.5,
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: '/geojson/land.geojson',
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: false,
      opaque: false,
      color: {
        inputRange: {
          type: 'zoom',
          ranges: [
            { stop: 1, input: 'rgb(33, 49, 62)' },
            { stop: 6, input: 'rgb(239, 238, 105)' },
          ],
        },
      },
      lch: true,
    },
  ],
};

export default style;
