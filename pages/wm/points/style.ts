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
    planet: '/tiles/wm/osm'
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
      source: 'planet',
      layer: 'place',
      type: 'point',
      color: '#007bfe',
      radius: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 3.5 },
            { stop: 2, input: 9 }
          ]
        }
      }
    }
  ]
}

export default style
