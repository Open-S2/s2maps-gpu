const Color = require('./conditionals/color').default
const { encodeFeatureFunction, encodeLayerFunction, decodeFeature } = require('./conditionals/parseCondition').default
// const chroma = require('chroma-js')
// const filterFunction = require('./conditionals/filterFunction').default

// const input2 = [
//   "data-condition",
//   ["class", "==", "ocean"],
//   "rgba(5, 100, 125, .5)",
//   ["class", "==", "river"],
//   ["data-condition", ["elev", "==", 12], "rgba(5, 100, 125, .5)", ["elev", "==", 0], "rgba(22, 220, 220, 1)", "default", "rgba(200, 160, 100, .5)"],
//   "default",
//   "rgba(20, 200, 200, 1)"
// ]
//
// const input3 = [
//   "data-range",
//   "lin",
//   "elev",
//   0,
//   "rgba(5, 100, 125, .5)",
//   5,
//   "rgba(20, 130, 200, 0.75)",
//   7,
//   input2
// ]

// const input = [
//   "zoom-range",
//   "lin",
//   0,
//   "rgba(5, 100, 125, .5)",
//   5,
//   input3,
//   7,
//   input2
// ]

// const input4 = [
//   "input-condition",
//   ["zoom", "==", "5"],
//   "rgba(5, 100, 125, .5)",
//   ["lat", ">", "90"],
//   "rgba(200, 160, 100, .8)",
//   "default",
//   "rgba(20, 200, 200, 1)"
// ]
//
// const input3 = [
//   "data-condition",
//   ["class", "==", "ocean"],
//   "rgba(5, 100, 125, .5)",
//   ["class", "==", "river"],
//   "rgba(200, 160, 100, .8)",
//   "default",
//   "rgba(20, 200, 200, 1)"
// ]

const input2 = [
  "data-range",
  "expo",
  0.5,
  "elev",
  2,
  "rgba(5, 100, 125, .5)",
  5,
  "rgba(200, 160, 100, .8)",
  7,
  "rgba(20, 200, 200, 1)"
]

// const input = [
//   "input-range",
//   "zoom",
//   "lin",
//   0,
//   input3
//   5,
//   input2,
//   7,
//   "rgba(20, 200, 200, 1)"
// ]

// const inputZoom = [
//   "input-range",
//   "zoom",
//   "lin",
//   2,
//   "rgba(5, 100, 125, .5)",
//   5,
//   "rgba(200, 160, 100, .8)",
//   7,
//   "rgba(20, 200, 200, 1)"
// ]

// const input = "rgba(200, 160, 100, .8)"
//
// const inputClone = JSON.parse(JSON.stringify(input2))
// const inputCloneEncode = JSON.parse(JSON.stringify(input2))
//
// const encodeFeatureFunc = encodeFeatureFunction(inputClone)
// const encodedLayer = encodeLayerFunction(inputCloneEncode)
// console.log('encodedLayer', encodedLayer)
//
// const featureEncoding = []
//
// encodeFeatureFunc({ class: 'ocean', elev: 3 }, featureEncoding)
// featureEncoding.unshift(featureEncoding.length)
// console.log('featureEncoding', featureEncoding)
//
// const decoded = decodeFeature(encodedLayer, featureEncoding, [9, 0, 0], true, 0, 1)
// console.log(decoded)











/*** LIINNESSS ***/

// const colorZoom = [
//   "input-range",
//   "zoom",
//   "lin",
//   2,
//   "rgb(33, 49, 62)",
//   7,
//   "rgb(239, 238, 105)"
// ]

const colorZoom = [
  "data-condition",
  ["class", "has", ["golf", "grass", "garden", "meadow", "wood", "swamp", "forest", "wetland", "zoo"]],
  "rgb(201, 238, 201)",
  ["class", "has", ["park", "national_park", "protected_area"]],
  [
    "input-range",
    "zoom",
    "lin",
    3,
    "rgb(205, 236, 205)",
    4,
    "rgb(197, 232, 197)"
  ],
  ["class", "==", "cemetery"],
  "rgb(208, 236, 208)",
  ["class", "==", "indianReservation"],
  "rgb(240, 237, 235)",
  "default",
  "rgba(0, 0, 0, 0)"
]

const inputZoom = [
  "input-range",
  "zoom",
  "lin",
  0.9, // zoom
  0, // VALUE
  5, // zoom
  5, // VALUE
  7, // zoom
  7  // VALUE
]

const inputCondition = [
  "input-condition",
  ["zoom", "==", "5"],
  "rgba(5, 100, 125, .5)",
  ["lat", ">", "90"],
  "rgba(200, 160, 100, .8)",
  "default",
  "rgba(20, 200, 200, 1)"
]

const exampleFailing = {
  "id": "boundaries",
  "source": "fills",
  "layer": "boundary",
  "filter": ["all", ["class", "has", ["Country", "State"]], ["maritime", "==", false]],
  "type": "line",
  "minzoom": 0,
  "layout": {
    "cap": "butt",
    "join": "bevel"
  },
  "paint": {
    "color": [
      "data-condition",
      ["class", "==", "State"],
      "rgba(160, 160, 160, 0.7)",
      "default",
      "rgb(145, 145, 145)"
    ],
    "width": [
      "data-condition",
      ["class", "==", "State"],
      0.85,
      "default",
      [
        "input-range",
        "zoom",
        "lin",
        1,
        2,
        2,
        3
      ]
    ]
  }
}

// const failingColor = [
//   "data-condition",
//   ["class", "==", "State"],
//   "rgba(160, 160, 160, 0.7)",
//   "default",
//   "rgb(145, 145, 145)"
// ]

const failingWidth = [
  "data-condition",
  ["class", "==", "State"],
  0.85,
  "default",
  [
    "input-range",
    "zoom",
    "lin",
    1,
    2,
    2,
    3
  ]
]
// const failingWidth = 0.85

const input = 5

const inputClone = JSON.parse(JSON.stringify(failingWidth))
const inputCloneEncode = JSON.parse(JSON.stringify(failingWidth))
// const widthInputClone = JSON.parse(JSON.stringify(failingWidth))
// const widthInputCloneEncode = JSON.parse(JSON.stringify(failingWidth))

const layerCode = []

const encodeFeatureFunc = encodeFeatureFunction(inputClone)
layerCode.push(...encodeLayerFunction(inputCloneEncode))
// const colorencodeFeatureFunc = encodeFeatureFunction(widthInputClone)
// console.log('encodeLayerFunction(widthInputCloneEncode)', encodeLayerFunction(widthInputCloneEncode))
// layerCode.push(...encodeLayerFunction(widthInputCloneEncode))
console.log('layerCode', layerCode.length, layerCode)

const featureCode = []

// colorencodeFeatureFunc({ class: 'park' }, featureCode)
encodeFeatureFunc({ class: 'Country' }, featureCode)
console.log('featureCode', featureCode)
// featureCode[0] = 3

// const color = decodeFeature(layerCode, featureCode, [0.5, 0, 0], true, 0, 0)
// console.log(color)

console.log('***********************')
// find position
const color = decodeFeature(layerCode, featureCode, [1.5, 0, 0], false, 0, 0)
console.log(color)














// // first level decode
// const parsedDecode = parseConditionDecode(inputCloneDecode)
// console.log('parsedDecode', parsedDecode.toString())
// // second level decode
// const fullParsedDecode = parsedDecode(encoding)
// console.log('fullParsedDecode', fullParsedDecode)
//
// const res = (typeof fullParsedDecode === 'function') ? fullParsedDecode(7) : fullParsedDecode
// if (res instanceof Color) res.toRGB()
//
// console.log(res)
//
//
// let color1 = new Color(55, 200, 125, 1, 'rgb')
// let color2 = new Color(10, 130, 0, 1, 'rgb')
//
// let interp = Color.interpolate(color1, color2, 1)
// console.log('test', color1)













// const input = "rgba(255, 255, 255, 255)"
// const input = [
//   "zoom-range",
//   "quad",
//   0,
//   "rgba(5, 100, 125, .5)",
//   5,
//   "rgba(20, 130, 200, 0.75)",
//   7,
//   "rgba(20, 200, 200, 1)"
// ]

// const input = [
//   "zoom-range",
//   "quad",
//   0,
//   10,
//   5,
//   20,
//   7,
//   30
// ]

// const input = [
//   "data-condition",
//   ["class", "==", "ocean"],
//   "rgba(5, 100, 125, .5)",
//   ["class", "==", "river"],
//   ["zoom-range", "lin", 0, "rgba(0, 0, 0, 0)", 5, "rgba(5, 100, 125, 0.7)", 10, "rgba(20, 130, 200, 1)"],
//   "default",
//   "rgba(20, 200, 200, 1)"
// ]

// const input = [
//   "zoom-range",
//   "quad",
//   0,
//   "rgba(5, 100, 125, .5)",
//   5,
//   "rgba(20, 130, 200, 0.75)",
//   7,
//   [
//     "data-condition",
//     ["class", "==", "ocean"],
//     "rgba(5, 100, 125, .5)",
//     ["class", "==", "river"],
//     "rgba(0, 0, 0, 0)"
//   ]
// ]

// const input = [
//   "data-range",
//   "lin",
//   "elev",
//   0,
//   "rgba(5, 100, 125, .5)",
//   5,
//   "rgba(20, 130, 200, 0.75)",
// ]
//
// const parsed = parseCondition(input)
//
// console.log(parsed({ class: 'ocean', elev: 12 }, 0))

// const input = [
//   "all",
//   ["class", "has", ["ocean", "river", "lake", "something"]],
//   ["elev", "!has", [0, 5]]
// ]

// const color1 = new Color('rgba(40, 100, 125, .5)')
// const color2 = new Color('rgba(45, 130, 200, 0.75)')
// color1.toLCH()
// color2.toLCH()
//
// // let chromaColor = chroma('rgba(20, 100, 125, .5)').lab()
// // let chromaColor = chroma.lch([45.681335944899025, 34.42558232064782, 251.39107061142417, 0.625])
// // console.log('chromaColor', chromaColor)
//
// // console.log('lch1', color1)
// // console.log('lch2', color2)
//
// const res = Color.interpolate(color1, color2, 1)
// // console.log('lchInterp', res)
// res.toRGB()
//
// console.log(res)
// // color1.toRGB()
// // color2.toRGB()
// // console.log(color1)
// // console.log(color2)

// Color {
//   val: [ 29.24999999999999, 117.48846726190476, 162.5, 0.625 ],
//   type: 'rgb'
// }

// const input = [
//   "any",
//   ["all", ["class", "==", "ocean"], ["elev", "!=", 0]],
//   ["all", ["class", "==", "river"], ["elev", "==", 0]],
// ]
//
// const filter = filterFunction(input)
//
// console.log(filter({ class: 'river', elev: 0 }))

// { color: [
//    "zoom-range",
//    "lin"
//    0,
//    "rgba(5, 100, 125, 255)",
//    5,
//    ["data-condition", ["class", "==", "river"], "rgba(5, 100, 125, 200)", ["class", "==", "ocean"], "rgba(20, 130, 200, 255)", "default": "rgba(20, 130, 200, 255)"]],
// }
