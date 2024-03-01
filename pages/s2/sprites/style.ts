import type { StyleDefinition } from 's2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Sprites',
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
      iconFamily: 'streets',
      iconField: 'amusement_park_15',
      iconAnchor: 'center',
      iconSize: 1,
      iconOffset: [0, 0],
      iconPadding: [0, 0],
      viewCollisions: true
    }
  ]
}

export default style
