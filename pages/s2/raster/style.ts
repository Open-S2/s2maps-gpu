import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Raster',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    satellite: '/tiles/s2/modis'
  },
  fonts: {},
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: 'rgb(9, 8, 17)'
    },
    {
      name: 'sat',
      source: 'satellite',
      type: 'raster'
    }
  ]
}

export default style
