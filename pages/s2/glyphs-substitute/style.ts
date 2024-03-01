import type { StyleDefinition } from 's2/style/style.spec'
import type { S2FeatureCollection } from 's2/geometry'

const data: S2FeatureCollection = {
  type: 'S2FeatureCollection',
  faces: [0, 1, 3, 4],
  features: [
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'བོད་རང་སྐྱོང་ལྗོངས།'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0.5]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'السودان'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 1]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'ישראל'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: '中国'
      },
      geometry: {
        type: 'Point',
        coordinates: [1, 0.5]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'မြန်မာ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0, 0.5]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: '대한민국'
      },
      geometry: {
        type: 'Point',
        coordinates: [1, 1]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'বাংলাদেশ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'ประเทศไทย'
      },
      geometry: {
        type: 'Point',
        coordinates: [0, 1]
      }
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'រាជធានីភ្នំពេញ'
      },
      geometry: {
        type: 'Point',
        coordinates: [1, 0]
      }
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ᑭᙵᐃᓚᒃ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0.5]
      }
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ශ්‍රී ලංකාව இலங்கை'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 1]
      }
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ދިވެހިރާއްޖެ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0]
      }
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ኢትዮጵያ'
      },
      geometry: {
        type: 'Point',
        coordinates: [1, 1]
      }
    },
    {
      type: 'S2Feature',
      face: 4,
      properties: {
        name: 'ഇന്ത്യ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0.5]
      }
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'କମ୍ବୋଡ଼ିଆ'
      },
      geometry: {
        type: 'Point',
        coordinates: [0.5, 0.5]
      }
    }
  ]
}

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Glyphs',
  center: [0, 0],
  zoom: 0,
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: '/s2json/countriesHD.s2json',
    textTest: {
      type: 'json',
      data
    }
  },
  fonts: {
    robotoMedium: '/api/glyphs-v2/RobotoMedium',
    NotoMedium: '/api/glyphs-v2/NotoMedium'
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
      name: 'poi-labels',
      source: 'textTest',
      type: 'glyph',
      interactive: false,
      textFamily: ['robotoMedium', 'NotoMedium'],
      textField: '?name',
      textAnchor: 'center',
      textOffset: [0, 0],
      textPadding: [2, 2],
      textLineHeight: 0.3,
      textSize: 34,
      textFill: '#1a73e7',
      textStroke: 'rgba(255, 255, 255, 0.75)',
      textStrokeWidth: 0.5,
      textWordWrap: 4,
      overdraw: false,
      viewCollisions: false
    }
  ]
}

export default style
