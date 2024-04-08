import type { StyleDefinition } from 'style/style.spec'

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Glyphs Paths using placement of line-center-path',
  view: {
    zoom: -0.5,
    lon: -122.4585607773497,
    lat: 37.778443127730476
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
    lineGlyphs: '/s2json/lineGlyphs.s2json'
  },
  fonts: {
    robotoMedium: '/api/glyphs-v2/RobotoMedium'
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff'
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6'
    },
    {
      name: 'line-glyphs',
      source: 'lineGlyphs',
      type: 'line',
      color: '#4a4a4a',
      width: 1.75,
      interactive: false
    },
    {
      name: 'poi-labels',
      source: 'lineGlyphs',
      type: 'glyph',
      interactive: true,
      cursor: 'pointer',
      placement: 'line-center-path',
      textFamily: ['robotoMedium'],
      textField: '?name',
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [4, 4],
      textSize: {
        inputRange: {
          type: 'zoom',
          ease: 'lin',
          ranges: [
            { stop: 0, input: 14 },
            { stop: 3, input: 22 },
            { stop: 4, input: 24 }
          ]
        }
      },
      // textSize: 14,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      textWordWrap: 8,
      overdraw: false,
      viewCollisions: false
    }
  ]
}

export default style
