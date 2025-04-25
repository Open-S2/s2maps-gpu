import type { S2FeatureCollection } from 's2json-spec';
import type { StyleDefinition } from 'style/style.spec.js';

const data: S2FeatureCollection = {
  type: 'S2FeatureCollection',
  faces: [0, 1, 2, 3, 4, 5],
  features: [
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'བོད་རང་སྐྱོང་ལྗོངས། ༒',
        type: 'tibetan',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'السودان',
        type: 'arabic',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'ישראל',
        type: 'hebrew',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: '中国',
        type: 'chinese',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 1, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'မြန်မာ',
        type: 'myanmar',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: '대한민국',
        type: 'hangul',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 1, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'বাংলাদেশ',
        type: 'bengali',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 0 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'ประเทศไทย',
        type: 'thai',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 0,
      properties: {
        name: 'င်္က္ကျြွှေို့်ာှီ့ၤဲံ့းႍ',
        type: 'myanmar',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 1, y: 0 },
      },
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ᑭᙵᐃᓚᒃ',
        type: 'canadian syllabics',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ශ්‍රී ලංකාව இலங்கை',
        type: 'sinhala',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ދިވެހިރާއްޖެ',
        type: 'Thaana',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0 },
      },
    },
    {
      type: 'S2Feature',
      face: 1,
      properties: {
        name: 'ኢትዮጵያ',
        type: 'ethiopic',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 1, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 4,
      properties: {
        name: 'ഇന്ത്യ',
        type: 'malayalam',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'କମ୍ବୋଡ଼ିଆ',
        type: 'oriya',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'ᨑᨗ ᨍᨍᨗᨕᨂᨗ',
        type: 'buginese',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'ꦧꦺꦲꦏ꧀ꦠꦸꦩꦿꦥ꧀ꦲ',
        type: 'javanese',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 1, y: 0.5 },
      },
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'រាជធានីភ្នំពេញ',
        type: 'khmer',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 1 },
      },
    },
    {
      type: 'S2Feature',
      face: 3,
      properties: {
        name: 'මනුෂ්‍යයෝ',
        type: 'sinhala',
      },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 1 },
      },
    },
  ],
};

const style: StyleDefinition = {
  version: 1,
  experimental: true,
  name: 'S2 Glyphs that use Substitutions',
  view: {
    zoom: 0,
    lon: 0,
    lat: 0,
  },
  minzoom: -0.5,
  maxzoom: 5,
  sources: {
    countries: 'dataURL://s2json/countriesHD.s2json',
    textTest: {
      type: 'json',
      data,
    },
  },
  fonts: {
    robotoMedium: 'apiURL://glyphs-v2/RobotoMedium',
    NotoMedium: 'apiURL://glyphs-v2/NotoMedium',
  },
  layers: [
    {
      name: 'background',
      type: 'fill',
      source: 'mask',
      opaque: true,
      color: '#fff',
    },
    {
      name: 'country-fill',
      source: 'countries',
      type: 'fill',
      invert: true,
      opaque: false,
      color: '#b4c1c6',
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
      viewCollisions: false,
    },
  ],
};

export default style;
