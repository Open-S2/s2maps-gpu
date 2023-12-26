import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'WM Cluster',
  projection: 'WM',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    planet: '/tiles/wm/osm',
    earthquakes: {
      type: 'json',
      path: '/geojson/earthquakes.geojson',
      extension: 'geojson',
      cluster: true,
      radius: 75
    }
  },
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      color: '#b4c1c6'
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
              input: '#f28cb1'
            },
            {
              filter: { key: '__sum', comparator: '>', value: 100 },
              input: '#f1f075'
            }
          ],
          fallback: '#51bbd6'
        }
      },
      radius: {
        dataCondition: {
          conditions: [
            {
              filter: { key: '__sum', comparator: '>', value: 750 },
              input: 80
            },
            {
              filter: { key: '__sum', comparator: '>', value: 100 },
              input: 60
            }
          ],
          fallback: 40
        }
      }
    }
  ]
}

export default style
