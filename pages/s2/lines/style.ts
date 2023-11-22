import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Lines',
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
      name: 'country-line',
      source: 'countries',
      type: 'line',
      color: '#bbd3de',
      width: 5
    }
  ]
}

export default style
