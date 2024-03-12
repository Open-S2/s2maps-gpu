import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Fill Pattern',
  center: [0, 0],
  zoom: -0.5,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/wm/osm'
  },
  images: {
    pattern: '/images/pattern.jpg'
  },
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      pattern: 'pattern',
      patternMovement: true,
      color: '#b4c1c6'
    }
  ]
}

export default style
