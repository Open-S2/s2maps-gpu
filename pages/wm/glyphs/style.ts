import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'WM Glyphs',
  projection: 'WM',
  center: [-40, 37.778443127730476],
  zoom: 1.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    planet: '/tiles/wm/osm'
  },
  fonts: {
    robotoMedium: '/api/glyphs/RobotoMedium.font'
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
      name: 'poi-labels',
      filter: {
        key: 'class',
        comparator: '==',
        value: 'country'
      },
      source: 'planet',
      layer: 'place',
      type: 'glyph',
      interactive: false,
      textFamily: 'robotoMedium',
      textField: '?!Uname',
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [2, 2],
      textSize: 14,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      textWordWrap: 8,
      overdraw: false,
      viewCollisions: true
    }
  ]
}

export default style
