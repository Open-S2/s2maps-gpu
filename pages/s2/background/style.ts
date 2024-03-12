import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Background',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {},
  fonts: {},
  layers: [
    {
      type: 'fill',
      name: 'background',
      source: 'mask',
      opaque: true,
      color: '#b4c1c6'
    }
  ]
}

export default style
