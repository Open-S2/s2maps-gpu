import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 's2maps-hilbert',
  center: [0, 0],
  zoom: -0.65,
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    countries: '/s2json/countriesHD.s2json'
  },
  fonts: {},
  layers: [
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      opaque: false,
      color: '#b4c1c6',
      interactive: false
    },
    {
      name: 'markers',
      source: '_markers',
      type: 'point',
      color: 'rgb(220, 83, 83)',
      radius: 20,
      stroke: 'rgb(220, 83, 83)',
      strokeWidth: 1,
      opacity: 1
    }
  ]
}

export default style
