import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  projection: 'WM',
  name: 'WM Raster',
  center: [0, 0],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5.5,
  sources: {
    satellite: '/tiles/wm/satellite'
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      color: '#ffffff'
    },
    {
      name: 'sat',
      source: 'satellite',
      type: 'raster'
    }
  ]
}

export default style
