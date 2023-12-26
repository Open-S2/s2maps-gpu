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
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#cbe5be'
    },
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
      altitude: 30,
      shadowColor: '#000',
      highlightColor: '#fff',
      accentColor: 'rgba(0, 0, 0, 0.5)',
      azimuth: 287
    }
  ]
}

export default style
