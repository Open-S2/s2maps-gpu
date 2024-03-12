import type { StyleDefinition } from 's2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'WM Points',
  projection: 'WM',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5.5,
  sources: {
    planet: '/tiles/wm/osm',
    benchmarks: {
      type: 'json',
      path: '/geojson/benchmarks.geojson',
      extension: 'geojson',
      cluster: true,
      radius: 2,
      maxzoom: 7
    }
  },
  layers: [
    {
      name: 'water-fill',
      source: 'planet',
      layer: 'water',
      type: 'fill',
      color: '#b4c1c6'
    },
    {
      name: 'country-points',
      source: 'benchmarks',
      type: 'point',
      color: '#007bfe',
      radius: 3
    }
  ]
}

export default style
