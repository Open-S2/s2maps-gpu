import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'Convert S2JSON to GeoJSON',
  projection: 'WM',
  view: {
    lon: 0,
    lat: 0,
    zoom: -0.5
  },
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    planet: '/tiles/wm/osm',
    hilbert: {
      type: 'json',
      data: {
        type: 'S2FeatureCollection',
        faces: [0],
        features: [
          {
            type: 'S2Feature',
            face: 0,
            properties: {
              class: 'hilbert',
              level: 4,
              levels: [0, 1, 2, 3]
            },
            geometry: {
              type: 'Point',
              coordinates: [0.5, 0.5]
            }
          }
        ]
      }
    }
  },
  fonts: {},
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      invert: false,
      opaque: false,
      color: '#b4c1c6'
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