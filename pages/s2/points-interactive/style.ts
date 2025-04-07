import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Points Interactive',
  view: {
    zoom: -0.5,
    lon: 0,
    lat: 0,
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
    hilbert: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            properties: {
              name: 'A',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0.5, y: 0.5 },
            },
          },
          {
            type: 'S2Feature',
            properties: {
              name: 'B',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0.51, y: 0.51 },
            },
          },
          {
            type: 'S2Feature',
            properties: {
              name: 'C',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0, y: 0 },
            },
          },
          {
            type: 'S2Feature',
            properties: {
              name: 'D',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 1, y: 1 },
            },
          },
          {
            type: 'S2Feature',
            properties: {
              name: 'E',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0, y: 1 },
            },
          },
          {
            type: 'S2Feature',
            properties: {
              name: 'F',
            },
            face: 0,
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 1, y: 0 },
            },
          },
        ],
      },
    },
  },
  fonts: {},
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      opaque: false,
      color: '#b4c1c6',
      interactive: false,
    },
    {
      name: 'hilbert_point',
      source: 'hilbert',
      type: 'point',
      color: '#475569',
      stroke: '#fff',
      strokeWidth: 5,
      radius: 15,
      interactive: true,
      cursor: 'pointer',
    },
  ],
};

export default style;
