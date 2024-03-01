import type { StyleDefinition } from 's2/style/style.spec'

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
    usa: '/geojson/usa.geojson'
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
      name: 'usa-fill',
      source: 'usa',
      type: 'fill',
      color: '#007bfe'
    }
  ]
}

export default style
