import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'WM Cluster',
  projection: 'WM',
  view: {
    lon: -122.4585607773497,
    lat: 37.778443127730476,
    zoom: -0.5,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://geojson/countries.geojson',
    earthquakes: {
      type: 'json',
      path: 'dataURL://geojson/earthquakes.geojson',
      extension: 'geojson',
      cluster: true,
      radius: 75,
    },
  },
  layers: [
    {
      name: 'countries-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      color: '#b4c1c6',
    },
    {
      name: 'earthquake-points',
      source: 'earthquakes',
      type: 'point',
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: '__sum', comparator: '>', value: 750 },
              input: '#f28cb1',
            },
            {
              filter: { key: '__sum', comparator: '>', value: 100 },
              input: '#f1f075',
            },
          ],
          fallback: '#51bbd6',
        },
      },
      radius: {
        dataCondition: {
          conditions: [
            {
              filter: { key: '__sum', comparator: '>', value: 750 },
              input: 80,
            },
            {
              filter: { key: '__sum', comparator: '>', value: 100 },
              input: 60,
            },
          ],
          fallback: 40,
        },
      },
    },
  ],
};

export default style;
