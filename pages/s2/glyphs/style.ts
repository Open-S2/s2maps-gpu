import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Glyphs',
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
  fonts: {
    robotoMedium: '/api/glyphs-v2/RobotoMedium',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff',
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'poi-labels',
      source: 'countries',
      type: 'glyph',
      interactive: true,
      cursor: 'pointer',
      textFamily: ['robotoMedium'],
      textField: '?!Uname',
      textAnchor: 'center',
      textAlign: 'left',
      textOffset: [0, 0],
      textPadding: [2, 2],
      textSize: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 14 },
            { stop: 3, input: 22 },
            { stop: 4, input: 24 },
          ],
        },
      },
      // textSize: 14,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      textWordWrap: 8,
      overdraw: false,
      viewCollisions: true,
      geoFilter: ['line', 'poly'],
    },
  ],
};

export default style;
