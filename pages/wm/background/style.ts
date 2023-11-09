import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'webmercator background',
  center: [0, 0],
  zoom: 0.95,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/merc/osm'
  },
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff'
    },
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6'
    }
  ]
}

export default style
