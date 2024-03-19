import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Lines',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0.95
  },
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
      width: 1.85
    }
  ]
}

export default style
