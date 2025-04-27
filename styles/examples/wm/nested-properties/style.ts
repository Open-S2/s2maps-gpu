import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Nested Properties',
  projection: 'WM',
  view: {
    lon: 0,
    lat: 0,
    zoom: 2,
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    land: 'dataURL://geojson/land.geojson',
    hilbert: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            properties: {
              class: 'hilbert',
              level: 4,
              levels: [0, 1, 2, 3],
              subClass: {
                subSubClass: {
                  type: 'hil',
                  radius: 40,
                },
              },
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0.5, y: 0.5 },
            },
          },
        ],
      },
    },
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'hilbert_point',
      source: 'hilbert',
      // filter: {
      //   key: {
      //     nestedKey: 'subClass',
      //     key: {
      //       nestedKey: 'subSubClass',
      //       key: 'type'
      //     }
      //   },
      //   comparator: '==',
      //   value: 'hil'
      // },
      filter: {
        key: { nestedKey: ['subClass', 'subSubClass', 'type'] },
        comparator: '==',
        value: 'hil',
      },
      type: 'point',
      color: '#475569',
      radius: {
        inputValue: {
          key: { nestedKey: ['subClass', 'subSubClass', 'radius'] },
          fallback: 5,
        },
      },
    },
  ],
};

export default style;
