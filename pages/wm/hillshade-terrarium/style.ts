import type { StyleDefinition } from 'style/style.spec';

const style: StyleDefinition = {
  version: 1,
  projection: 'WG',
  name: 'WM Hillshade Terrarium',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.5,
  },
  minzoom: 0.5,
  maxzoom: 6.9,
  zoomOffset: 0.5,
  sources: {
    land: '/geojson/land.geojson',
    terrain: '/tiles/wm/terrarium2x',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#cbe5be',
    },
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6',
    },
    {
      name: 'terrain-hillshade',
      source: 'terrain',
      type: 'hillshade',
      altitude: 30,
      shadowColor: '#000',
      highlightColor: '#fff',
      accentColor: 'rgba(0, 0, 0, 0.5)',
      azimuth: 287,
      unpack: {
        // (color.r * 256. + color.g + color.b / 256.) - 32768.;
        offset: -32768,
        zFactor: 1,
        rMultiplier: 256,
        gMultiplier: 1,
        bMultiplier: 1 / 256,
        aMultiplier: 0,
      },
    },
  ],
};

export default style;
