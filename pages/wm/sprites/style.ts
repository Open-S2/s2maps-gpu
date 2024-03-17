import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'WM Glyphs',
  projection: 'WM',
  center: [0, 0],
  zoom: 1.5,
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
      color: '#b4c1c6'
    },
    {
      name: 'planet-icons',
      filter: {
        key: 'class',
        comparator: '==',
        value: 'country'
      },
      source: 'planet',
      layer: 'place',
      type: 'glyph',
      iconFamily: 'streets',
      iconField: 'amusement_park_15',
      iconAnchor: 'center',
      iconSize: 1,
      iconOffset: [0, 0],
      iconPadding: [0, 0],
      viewCollisions: true,
      overdraw: false
    }
  ]
}

export default style
