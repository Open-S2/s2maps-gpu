import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Markers',
  view: {
    zoom: -0.65,
    lon: 0,
    lat: 0,
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    countries: 'http://localhost:3000/s2json/countriesHD.s2json',
    markers: {
      type: 'markers',
      path: '_markers',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [0, 0],
            },
          },
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [20, 40],
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
      name: 'markers',
      source: 'markers',
      type: 'point',
      color: 'rgb(220, 83, 83)',
      radius: 20,
      stroke: 'rgb(220, 83, 83)',
      strokeWidth: 1,
      opacity: 1,
    },
  ],
};

export default style;
