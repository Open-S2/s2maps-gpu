import type { StyleDefinition } from '../../../s2/style/style.spec'

const style: StyleDefinition = {
  version: 1,
  name: 's2maps-streets-v1',
  center: [-111.88683599228256, 40.76645913667518],
  // center: [0, 0],
  zoom: 0,
  minzoom: -0.5,
  maxzoom: 18.99,
  sources: {
    streets: 'http://localhost:8008/s2tiles/s2maps/streets-v1.s2tiles',
    terrain: 'http://localhost:8008/s2tiles/s2maps/terrain-v1.s2tiles'
  },
  fonts: {
    robotoRegular: 'http://localhost:8008/glyphs-v2/RobotoRegular',
    robotoMedium: 'http://localhost:8008/glyphs-v2/RobotoMedium',
    notoRegular: 'http://localhost:8008/glyphs-v2/NotoRegular',
    notoMedium: 'http://localhost:8008/glyphs-v2/NotoMedium'
  },
  wallpaper: {
    background: '#030a2d',
    fade1: 'rgb(138, 204, 255)',
    fade2: 'rgb(217, 255, 255)',
    halo: 'rgb(230, 255, 255)'
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      opaque: true,
      source: 'mask',
      color: {
        inputRange: {
          type: 'zoom',
          ease: 'expo',
          base: 1.7,
          ranges: [
            { stop: 2.75, input: '#f9f7e7' },
            { stop: 3, input: '#f5f5f5' },
            { stop: 6.5, input: '#f0e9d7' },
            { stop: 9, input: '#f0e9d7' },
            { stop: 13, input: '#e8e8e8' },
            { stop: 14, input: '#f8f9fa' }
          ]
        }
      }
    },
    {
      name: 'equator',
      source: 'streets',
      layer: 'equator',
      type: 'line',
      minzoom: 0,
      maxzoom: 10,
      cap: 'butt',
      join: 'bevel',
      color: 'rgba(125, 102, 97, 0.8)',
      dasharray: [
        [20, 'rgba(125, 102, 97, 0.8)'],
        [20, 'rgba(255, 255, 255, 0)']
      ],
      width: 1.75
    }
  ]
}

export default style
