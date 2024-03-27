import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Fill',
  view: {
    lon: 0,
    lat: 0,
    zoom: 0
  },
  minzoom: 0,
  maxzoom: 6.9,
  sources: {
    land: '/geojson/land.geojson'
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'land',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6'
    }
  ]
}

export default style
