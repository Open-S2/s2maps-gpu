import type { StyleDefinition } from 's2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'Convert GeoJSON to S2JSON',
  center: [0, 0],
  zoom: -0.5,
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
    hilbert: {
      type: 'json',
      projection: 'S2',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              class: 'hilbert',
              level: 4,
              levels: [0, 1, 2, 3]
            },
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        ]
      }
    }
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
      name: 'hilbert_point',
      source: 'hilbert',
      type: 'point',
      color: '#475569',
      radius: 20
    }
  ]
}

export default style
