import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Invert Pattern',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json'
  },
  images: {
    pattern: '/images/sea-pattern.jpg'
  },
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      pattern: 'pattern',
      patternMovement: true,
      opaque: false,
      color: '#b4c1c6',
      invert: true,
      interactive: false
    }
  ]
}

export default style