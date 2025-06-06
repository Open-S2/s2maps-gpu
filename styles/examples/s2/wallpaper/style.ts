import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Wallpaper',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://s2json/countriesHD.s2json',
  },
  fonts: {},
  wallpaper: {
    background: '#030a2d',
    fade1: 'rgb(138, 204, 255)',
    fade2: 'rgb(217, 255, 255)',
    halo: 'rgb(230, 255, 255)',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#f9f7e7',
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#86bff2',
    },
  ],
};

export default style;
