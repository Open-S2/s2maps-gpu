import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Fill Pattern using Sprites',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json'
  },
  sprites: {
    streets: '/sprites/streets/sprite@2x'
  },
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      opaque: true,
      color: '#e0e0d1'
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      pattern: 'star_15',
      patternFamily: 'streets',
      opaque: false,
      color: 'rgba(164, 202, 214, 0.5)',
      opacity: 0.1,
      interactive: false
    }
  ]
}

export default style
