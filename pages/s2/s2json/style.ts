import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 JSON',
  view: {
    zoom: -0.4,
    lon: -90,
    lat: 0,
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    hilbert: '/s2json/hilbert.s2json',
  },
  fonts: {},
  layers: [
    {
      name: 'hilbert_path',
      source: 'hilbert',
      filter: {
        and: [
          {
            key: 'class',
            value: 'hilbert',
            comparator: '==',
          },
          {
            key: 'level',
            value: 4,
            comparator: '==',
          },
        ],
      },
      type: 'line',
      cap: 'butt',
      join: 'bevel',
      color: '#475569',
      width: 3,
    },
  ],
};

export default style;
