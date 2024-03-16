import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Markers',
  center: [0, 0],
  zoom: 0,
  minzoom: -1,
  maxzoom: 2.5,
  sources: {
    planet: '/tiles/wm/osm',
    markers: {
      type: 'markers',
      path: '_markers',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              name: 'A'
            },
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            }
          },
          {
            type: 'Feature',
            properties: {
              name: 'B'
            },
            geometry: {
              type: 'Point',
              coordinates: [120, -80]
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
      name: 'markers',
      source: 'markers',
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
