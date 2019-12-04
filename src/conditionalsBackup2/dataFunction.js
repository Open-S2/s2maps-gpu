// @flow
const Color = require('./color').default
// const { parseConditionEncode, parseConditionDecode } = require('./parseCondition')
const parseFilter = require('./parseFilter').default
const getEasingFunction = require('./easingFunctions').default

// consider two cases:
// one: the data condition results in a color
// two: the data condition results in another conditional
// examples:
// { "color": [
//    "data-condition",
//    ["class", "==", "ocean"],
//    "rgba(5, 100, 125, 255)",
//    ["class", "==", "river"],
//    ["zoom-range", "linear", 0, "rgba(0, 0, 0, 0)", 5, "rgba(5, 100, 125, 200)", 10, "rgba(20, 130, 200, 255)"]],
//    "default"
//    null
// ]}

// if this function was called, input[0] has already been shifted and "data-condition" has been removed
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

function encodeDataRangeFunction (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  const key = input.shift()

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

function decodeDataConditionFunction (input) {
  const conditions = []
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      conditions.push({
        key: filter[0],
        condition: parseFilter(filter),
        result: parseConditionDecode(input.shift())
      })
    } else if (input[0] === 'default') {
      input.shift()
      conditions['default'] = parseCondition(input.shift())
    }
  }
  if (!conditions['default']) conditions['default'] = () => null // just incase it's missing in the style json
  return (properties) => {
    if (properties) {
      for (const condition of conditions) { // run through the conditions
        if (condition.condition(properties)) {
          return condition.result(properties)
        }
      }
    }
    // if we made it here, just run default
    return conditions['default'](properties)
  }
}

function decodeDataRangeFunction (input) {
  // grab function type
  const zoomType = input.shift()
  const key = input.shift()
  const easeFunction = getEasingFunction(zoomType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionDecode(input[c])
    c += 2
  }

  return (properties, zoom) => {
    const dataInput = (properties && properties[key] != null && !isNaN(properties[key])) ? +properties[key] : 0
    if (dataInput <= input[0]) {
      return input[1](properties, dataInput)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](properties, dataInput)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = input[i - 2]
      const startValue = input[i - 1](properties, dataInput)
      if (startRange === dataInput) return startValue
      const endRange = input[i]
      const endValue = input[i + 1](properties, dataInput)
      // now we interpolate
      return easeFunction(dataInput, startRange, endRange, startValue, endValue)
    }
  }
}

exports.default = {
  encodeDataConditionFunction,
  encodeDataRangeFunction,
  decodeDataConditionFunction,
  decodeDataRangeFunction
}
