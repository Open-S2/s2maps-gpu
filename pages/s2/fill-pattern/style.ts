import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Fill Pattern',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
  },
  images: {
    pattern: '/images/pattern.jpg',
  },
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      pattern: 'pattern',
      opaque: false,
      color: '#b4c1c6',
      interactive: false,
    },
  ],
};

export default style;
