import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Glyphs',
  projection: 'WG',
  view: {
    lon: 0,
    lat: 0,
    zoom: 1.5,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    land: '/geojson/land.geojson',
    ports: '/geojson/ports.geojson',
  },
  sprites: {
    streets: '/sprites/streets/sprite@2x',
  },
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      color: '#b4c1c6',
    },
    {
      name: 'ports-icons',
      source: 'ports',
      type: 'glyph',
      iconFamily: 'streets',
      iconField: 'amusement_park_15',
      iconAnchor: 'center',
      iconSize: 1,
      iconOffset: [0, 0],
      iconPadding: [0, 0],
      viewCollisions: true,
      overdraw: false,
    },
  ],
};

export default style;
