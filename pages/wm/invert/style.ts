import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Invert',
  center: [0, 0],
  zoom: -0.5,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/wm/osm'
  },
  fonts: {},
  layers: [
    {
      name: 'water-invert',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      invert: true,
      color: '#b4c1c6'
    }
  ]
}

export default style