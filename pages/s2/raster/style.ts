import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 'S2 Raster',
  center: [-122.4585607773497, 37.778443127730476],
  zoom: -0.5,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    satellite: '/tiles/s2/modis'
  },
  fonts: {},
  skybox: {
    path: '/backgrounds/milkyway',
    loadingBackground: 'rgb(9, 8, 17)',
    size: 2048,
    type: 'webp'
  },
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
    //   {
    //     name: 'shade',
    //     source: 'mask',
    //     type: 'shade',
    //     maxzoom: 2
    //   }
  ]
}

export default style
