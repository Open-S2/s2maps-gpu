import type { StyleDefinition } from 's2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Points',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/landPoints.s2json'
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
              input: '#007bfe'
            }
          ],
          fallback: '#23374d'
        }
      },
      radius: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 3.5 },
            { stop: 2, input: 9 }
          ]
        }
      }
    }
  ]
}

export default style
