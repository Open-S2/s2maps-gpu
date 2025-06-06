import type { StyleDefinition } from 'style/style.spec.js';

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Points',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://s2json/landPoints.s2json',
  },
  fonts: {},
  layers: [
    {
      name: 'land-points',
      source: 'countries',
      type: 'point',
      interactive: false,
      color: {
        dataCondition: {
          conditions: [
            {
              filter: { key: 'country', comparator: '==', value: 'US' },
              input: '#007bfe',
            },
          ],
          fallback: '#23374d',
        },
      },
      radius: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 3.5 },
            { stop: 2, input: 9 },
          ],
        },
      },
    },
  ],
};

export default style;
