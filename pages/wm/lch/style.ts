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
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      invert: false,
      opaque: false,
      color: {
        inputRange: {
          type: 'zoom',
          ranges: [
            { stop: 1, input: 'rgb(33, 49, 62)' },
            { stop: 6, input: 'rgb(239, 238, 105)' }
          ]
        }
      },
      lch: true
    }
  ]
}

// rgb(33, 49, 62)
// rgb(239, 238, 105)

export default style