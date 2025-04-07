import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Icons',
  view: {
    zoom: -0.5,
    lon: 0,
    lat: 0,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
    iconFeatures: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            properties: { icon: 'zoo' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0, y: 0 } },
          },
          {
            type: 'S2Feature',
            properties: { icon: 'police' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0.5, y: 0.5 } },
          },
          {
            type: 'S2Feature',
            properties: { icon: 'aerodrome' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 1, y: 0 } },
          },
          {
            type: 'S2Feature',
            properties: { icon: 'pharmacy' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0, y: 1 } },
          },
          {
            type: 'S2Feature',
            properties: { icon: 'library' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 1, y: 1 } },
          },
        ],
      },
    },
  },
  icons: {
    streets: '/api/glyphs/streets',
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
      name: 'icon-examples',
      source: 'iconFeatures',
      type: 'glyph',
      interactive: false,
      iconFamily: ['streets'],
      iconField: '?icon',
      iconAnchor: 'center',
      iconOffset: [0, 0],
      iconPadding: [2, 2],
      iconSize: 32,
      overdraw: false,
      viewCollisions: false,
    },
  ],
};

export default style;
