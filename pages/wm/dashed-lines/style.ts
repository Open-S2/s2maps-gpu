import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Dashed Lines',
  center: [0, 0],
  zoom: 0.95,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/wm/osm'
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6'
    },
    {
      name: 'country-line',
      source: 'planet',
      layer: 'boundary',
      filter: {
        or: [
          { key: 'admin_level', comparator: 'has', value: [3, 4, 5, 6, 7, 8, 9, 10] },
          { key: 'maritime', comparator: '==', value: 0 }
        ]
      },
      type: 'line',
      color: '#bbd3de',
      width: 2.75,
      dasharray: [
        [30, '#bbd3de'],
        [12, 'rgba(255, 255, 255, 0)']
      ]
    }
  ]
}

export default style
