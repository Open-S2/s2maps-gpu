const Color = require('./conditionals/color').default
const { parseConditionEncode, parseConditionDecode } = require('./conditionals/parseCondition').default
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

const input2 = [
  "data-condition",
  ["class", "==", "ocean"],
  "rgba(5, 100, 125, .5)",
  ["class", "==", "river"],
  "rgba(200, 160, 100, .8)",
  "default",
  "rgba(20, 200, 200, 1)"
]

const input3 = [
  "zoom-range",
  "lin",
  0,
  "rgba(5, 100, 125, .5)",
  5,
  "rgba(200, 160, 100, .8)",
  7,
  input2
]

const input = [
  "data-range",
  "lin",
  "elev",
  0,
  "rgba(5, 100, 125, .5)",
  5,
  "rgba(20, 130, 200, 0.75)",
  7,
  input3
]

const inputClone = JSON.parse(JSON.stringify(input))

const parsedEncode = parseConditionEncode(inputClone)

const encoding = []

parsedEncode({ class: 'river', elev: 5.5 }, encoding)
console.log('encoding', encoding)

const inputCloneDecode = JSON.parse(JSON.stringify(input))

// first level decode
const parsedDecode = parseConditionDecode(inputCloneDecode)
// second level decode
const fullParsedDecode = parsedDecode(encoding)

const res = (typeof fullParsedDecode === 'function') ? fullParsedDecode(7) : fullParsedDecode
if (res instanceof Color) res.toRGB()

console.log(res)















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
