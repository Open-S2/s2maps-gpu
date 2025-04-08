import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Glyphs',
  projection: 'WG',
  view: {
    lon: -40,
    lat: 37.778443127730476,
    zoom: 1.5,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    land: '/geojson/land.geojson',
    ports: '/geojson/ports.geojson',
  },
  fonts: {
    robotoMedium: '/api/glyphs-v2/RobotoMedium',
  },
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      color: '#b4c1c6',
    },
    {
      name: 'poi-labels',
      source: 'ports',
      type: 'glyph',
      interactive: false,
      textFamily: 'robotoMedium',
      textField: '?!Uname',
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [2, 2],
      textSize: 14,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      textWordWrap: 8,
      overdraw: false,
      viewCollisions: true,
    },
  ],
};

export default style;
