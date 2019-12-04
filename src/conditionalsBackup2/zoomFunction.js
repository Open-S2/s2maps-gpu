// @flow
const Color = require('./color').default
// const parser = require('./parseCondition').default
const parseFilter = require('./parseFilter').default
const getEasingFunction = require('./easingFunctions').default

// consider two cases:
// one: the zoom condition results in a color
// two: the zoom condition results in another conditional
// examples:
// { color: [
//    "zoom-range",
//    "lin"
//    0,
//    "rgba(5, 100, 125, 255)",
//    5,
//    ["data-condition", ["class", "==", "river"], "rgba(5, 100, 125, 200)", ["class", "==", "ocean"], "rgba(20, 130, 200, 255)", "default": "rgba(20, 130, 200, 255)"]
//  ]
// }

function encodeZoomRangeFunction (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  // Basically, since we don't know which zoom we will encounter,
  // we have to pre-run every case, and the decoder will also have to pre-run each one:
  const preSolutions = {}
  for (let i = 0, il = input.length; i < il; i += 2) {
    if (Array.isArray(input[i + 1])) {
      preSolutions[input[i]] = parseConditionEncode(input[i + 1])
    }
  }
  // now store all possible outcomes that require inputs
  return (properties, encoding) => {
    for (let key in preSolutions) {
      preSolutions[key](properties, encoding)
    }
  }
}

function parseConditionEncode (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = encodeDataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = encodeDataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-range') {
      const parsedZoomFunction = encodeZoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => null }
  } else { return () => null } // the draw thread will naturally handle the appropraite color/number
}

function encodeDataConditionFunction (input) {
  const conditions = []
  let encodeResultID = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      conditions.push({
        key: filter[0],
        encodeID: encodeResultID,
        condition: parseFilter(filter),
        result: parseConditionEncode(input.shift())
      })
      encodeResultID++
    } else if (input[0] === 'default') {
      input.shift() // 'default'
      conditions['default'] = parseConditionEncode(input.shift())
    }
  }
  if (!conditions['default']) conditions['default'] = () => null // just incase it's missing in the style json
  return (properties, encoding) => {
    if (properties) {
      for (const condition of conditions) { // run through the conditions
        if (condition.condition(properties)) {
          encoding.push(condition.encodeID)
          return condition.result(properties, encoding)
        }
      }
    }
    // if we made it here, just run default
    encoding.push(0)
    return conditions['default'](properties)
  }
}

function encodeDataRangeFunction (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  const key = input.shift() // key

  // first parse all possible conditionals
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionEncode(input[c])
    c += 2
  }

  return (properties, encoding) => {
    const dataInput = (properties && properties[key] && !isNaN(properties[key])) ? +properties[key] : 0
    // first store the actual value
    encoding.push(dataInput)
    // run the functions just incase they have more encodings to share
    if (dataInput <= input[0]) {
      return input[1](properties, encoding)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](properties, encoding)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = input[i - 2]
      const startValue = input[i - 1](properties, encoding)
      // if equal to start, then we don't need to store the next encoding, we never reach it
      if (startRange === dataInput) return
      input[i + 1](properties, encoding)
      return
    }
  }
}

// this preps a getter function for change of zoom for color and opacity changes
function decodeZoomRangeFunction (input, encodings) {
  // grab function type
  const easeType = input.shift()
  const base = (easeType === 'expo') ? input.shift() : null
  const easeFunction = getEasingFunction(easeType, base)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseCondition(input[c], encodings)
    c += 2
  }

  return (zoom) => {
    if (zoom <= input[0]) {
      return input[1](zoom)
    } else if (zoom >= input[input.length - 2]) {
      return input[input.length - 1](zoom)
    } else {
      let i = 0
      while (input[i] <= zoom) i += 2
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = input[i - 2]
      const startValue = input[i - 1](zoom)
      if (startZoom === zoom) return startValue
      const endZoom = input[i]
      const endValue = input[i + 1](zoom)
      // now we interpolate
      return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
    }
  }
}

exports.default = {
  encodeZoomRangeFunction,
  decodeZoomRangeFunction
}
