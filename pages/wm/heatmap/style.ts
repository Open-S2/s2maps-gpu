import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Heatmap',
  projection: 'WG',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.95,
  },
  minzoom: 0,
  maxzoom: 7,
  sources: {
    land: '/geojson/land.geojson',
    earthquakes: '/geojson/earthquakes.geojson',
  },
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff',
    },
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'earthquakes-heat',
      source: 'earthquakes',
      type: 'heatmap',
      minzoom: 0,
      maxzoom: 8,
      colorRamp: [
        { stop: 0, color: 'rgba(33,102,172,0)' },
        { stop: 0.2, color: 'rgba(103,169,207, 0.85)' },
        { stop: 0.4, color: 'rgb(209,229,240)' },
        { stop: 0.6, color: 'rgb(253,219,199)' },
        { stop: 0.8, color: 'rgb(239,138,98)' },
        { stop: 1, color: 'rgb(178,24,43)' },
      ],
      weight: {
        dataRange: {
          key: 'mag',
          ranges: [
            { stop: 0, input: 0 },
            { stop: 8, input: 1 },
          ],
        },
      },
      radius: {
        inputRange: {
          type: 'zoom',
          ranges: [
            { stop: 0, input: 3 },
            { stop: 8, input: 30 },
          ],
        },
      },
      intensity: {
        inputRange: {
          type: 'zoom',
          ranges: [
            { stop: 0, input: 1 },
            { stop: 8, input: 3 },
          ],
        },
      },
      opacity: {
        inputRange: {
          type: 'zoom',
          ranges: [
            { stop: 4, input: 1 },
            { stop: 5, input: 0 },
          ],
        },
      },
    },
  ],
};

export default style;
