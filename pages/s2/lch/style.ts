import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 LCH color space',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 7,
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
      color: '#fff'
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: true,
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.5,
          ranges: [
            { stop: 1, input: 'rgb(33, 49, 62)' },
            { stop: 6, input: 'rgb(239, 238, 105)' }
          ]
        }
      },
      lch: true
    }
  ]
}

export default style