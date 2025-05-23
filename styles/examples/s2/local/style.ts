import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Local Source',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://s2json/countriesHD.s2json',
    local: '_local',
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
      name: 'local-line',
      source: 'local',
      layer: 'boundary',
      type: 'line',
      color: 'red',
      width: 2.5,
    },
  ],
};

export default style;
