import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Invert Pattern',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'http://localhost:3000/s2json/countriesHD.s2json',
  },
  images: {
    pattern: 'http://localhost:3000/images/sea-pattern.jpg',
  },
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      pattern: 'pattern',
      patternMovement: true,
      opaque: false,
      color: '#b4c1c6',
      invert: true,
      interactive: false,
    },
  ],
};

export default style;
