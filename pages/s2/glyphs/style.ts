import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Glyphs',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json'
  },
  fonts: {
    robotoMedium: 'http://localhost:3000/api/glyphs/RobotoMedium.font'
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff'
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6'
    },
    {
      name: 'poi-labels',
      source: 'countries',
      type: 'glyph',
      textFamily: 'robotoMedium',
      textField: '?!Uname',
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [1, 1],
      textSize: 12,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5
    }
  ]
}

export default style