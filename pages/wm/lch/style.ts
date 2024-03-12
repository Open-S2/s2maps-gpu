import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM LCH',
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

export default style
