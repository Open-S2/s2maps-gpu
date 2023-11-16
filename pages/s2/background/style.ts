import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Background',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json'
  },
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#b4c1c6'
    }
  ]
}

export default style
