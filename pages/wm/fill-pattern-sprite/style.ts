import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'WM Fill Pattern using Sprites',
  projection: 'WM',
  center: [0, 0],
  zoom: 0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    planet: '/tiles/wm/osm'
  },
  sprites: {
    streets: '/sprites/streets/sprite@2x'
  },
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      pattern: 'star_15',
      patternFamily: 'streets',
      patternMovement: true,
      color: '#b4c1c6'
    }
  ]
}

export default style
