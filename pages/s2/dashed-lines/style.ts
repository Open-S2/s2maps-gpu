import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Dashed Lines',
  view: {
    zoom: 3,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    hilbert: '/s2json/hilbert.s2json',
  },
  fonts: {},
  layers: [
    {
      name: 'hilbert-line',
      filter: { key: 'level', comparator: '==', value: 5 },
      source: 'hilbert',
      type: 'line',
      color: '#bbd3de',
      width: 2.75,
      dasharray: [
        [30, '#bbd3de'],
        [12, 'rgba(255, 255, 255, 0)'],
      ],
    },
  ],
};

export default style;
