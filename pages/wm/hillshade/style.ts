import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Fill',
  center: [0, 0],
  zoom: -0.5,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/wm/osm',
    terrain: '/tiles/wm/terrain-v2'
  },
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
      name: 'terrain-hillshade',
      source: 'terrain',
      type: 'hillshade',
      altitude: 70,
      shadowColor: '#000000',
      highlightColor: '#ffffff',
      accentColor: '#000000',
      azimuth: 315
    }
  ]
}

export default style
