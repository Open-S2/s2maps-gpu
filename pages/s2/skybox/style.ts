import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Skybox',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    satellite: '/tiles/s2/modis',
  },
  fonts: {},
  skybox: {
    path: 'baseURL://backgrounds/milkyway',
    loadingBackground: 'rgb(9, 8, 17)',
    size: 2048,
    type: 'webp',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: 'rgb(9, 8, 17)',
    },
  ],
};

export default style;
