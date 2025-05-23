import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Glyph Icon Pair',
  view: {
    zoom: -0.5,
    lon: 0,
    lat: 0,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://s2json/countriesHD.s2json',
    iconFeatures: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            properties: { name: 'Planet Zoo', icon: 'zoo' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0, y: 0 } },
          },
          {
            type: 'S2Feature',
            properties: { name: 'Police Station', icon: 'police' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0.5, y: 0.5 } },
          },
          {
            type: 'S2Feature',
            properties: { name: 'SLC Airport', icon: 'aerodrome' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 1, y: 0 } },
          },
          {
            type: 'S2Feature',
            properties: { name: 'CVS Pharmacy', icon: 'pharmacy' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 0, y: 1 } },
          },
          {
            type: 'S2Feature',
            properties: { name: 'Library', icon: 'library' },
            face: 0,
            geometry: { type: 'Point', is3D: false, coordinates: { x: 1, y: 1 } },
          },
        ],
      },
    },
  },
  fonts: {
    robotoMedium: 'apiURL://glyphs-v2/RobotoMedium',
  },
  icons: {
    streets: 'apiURL://glyphs/streets',
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
      interactive: true,
      cursor: 'pointer',
      textFamily: 'robotoMedium',
      textField: '?name',
      textAnchor: 'center',
      textOffset: [0, -55],
      textPadding: [2, 2],
      textSize: 20,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      iconFamily: 'streets',
      iconField: '?icon',
      iconAnchor: 'center',
      iconOffset: [0, 0],
      iconPadding: [2, 2],
      iconSize: 42,
      overdraw: false,
      viewCollisions: true,
    },
  ],
};

export default style;
