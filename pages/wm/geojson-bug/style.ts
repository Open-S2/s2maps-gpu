import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM GeoJSON',
  center: [0, 0],
  zoom: 0.95,
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    planet: '/tiles/wm/osm',
    bug: '/geojson/bug.geojson'
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      color: '#b4c1c6'
    },
    {
      name: 'bug-point',
      source: 'bug',
      type: 'point',
      color: '#007bfe',
      radius: 20
    }
  ]
}

export default style
