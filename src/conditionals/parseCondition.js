// @flow
const Color = require('./color').default
const parseFilter = require('./parseFilter').default

// This functionality is built for the Web Worker
function encodeFeatureFunction (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      return parseDataCondition(input)
    } else if (conditionType === 'input-condition') {
      // TODO
      // input.shift() // input-condition type
      // return parseInputCondition(input)
    } else if (conditionType === 'data-range') {
      return parseDataRange(input)
    } else if (conditionType === 'input-range') {
      input.shift() // input-range type
      return parseInputRange(input)
    } else { return () => null }
  } else { return () => null } // the draw thread will naturally handle the appropraite color/number
}

// CONDITION ENCODINGS: 128 positions possible, although if you're using more than 2 or 3 feature-states, you may need to rethink your design
// 0 -> null
// 1 -> value
// 2 -> data-condition
// 3 -> input-condition
// 4 -> data-range
// 5 -> input-range
// 6 -> animation-state
// 7+ -> feature-state

// INPUT RANGE/CONDITION ENCODINGS:
// 0 -> zoom
// 1 -> lat
// 2 -> lon
// 3 -> angle
// 4 -> pitch

// INTERPOLATION ENCODINGS: data-ranges or input-ranges have either linear or exponential interpolations
// if exponential the base must also be encoded, after the type
// 0 -> linear
// 1 -> exponential

// This functionality is built for webgl to parse for drawing
function encodeLayerFunction (input) {
  const encodings = []
  encodings.push(0) // store a null no matter what
  let length = 1
  if (Array.isArray(input)) { // conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      // set the condition bits as data-condition
      encodings[0] += (2 << 4)
      // encode the condition type
      subEncodings = encodeDataCondition(input)
      encodings.push(...subEncodings)
    } else if (conditionType === 'input-condition') {
      // set the condition bits as input-condition
      encodings[0] += (3 << 4)
      const inputConditionType = input.shift()
      // encode the input-condition type
      if (inputConditionType === 'zoom') encodings[0] += (0 << 1)
      else if (inputConditionType === 'lat') encodings[0] += (1 << 1)
      else if (inputConditionType === 'lon') encodings[0] += (2 << 1)
      else if (inputConditionType === 'angle') encodings[0] += (3 << 1)
      else if (inputConditionType === 'pitch') encodings[0] += (4 << 1)
      else throw Error('unknown input-condition type')
      // encode the condition type and store
      subEncodings = encodeInputCondition(input[0])
      encodings.push(...subEncodings)
    } else if (conditionType === 'data-range') {
      // set the condition bits as data-range
      encodings[0] += (4 << 4)
      // encode the interpolation type
      const inputRangeInterpType = input.shift()
      if (inputRangeInterpType === 'expo') {
        encodings[0] += 1
        // store base seperately as it can be a floating point
        encodings.push(input.shift())
      }
      // remove data type
      input.shift()
      // encode and store
      subEncodings = encodeRange(input)
      encodings.push(...subEncodings)
    } else if (conditionType === 'input-range') {
      // set the condition bits as input-range
      encodings[0] += (5 << 4)
      // encode the input-range type
      const inputRangeType = input.shift()
      if (inputRangeType === 'zoom') encodings[0] += (0 << 1)
      else if (inputRangeType === 'lat') encodings[0] += (1 << 1)
      else if (inputRangeType === 'lon') encodings[0] += (2 << 1)
      else if (inputRangeType === 'angle') encodings[0] += (3 << 1)
      else if (inputRangeType === 'pitch') encodings[0] += (4 << 1)
      else throw Error('unknown input-range type')
      // encode the interpolation type
      const inputRangeInterpType = input.shift()
      if (inputRangeInterpType === 'expo') {
        encodings[0] += 1
        // store base seperately as it can be a floating point
        encodings.push(input.shift())
      }
      // encode and store
      subEncodings = encodeRange(input)
      encodings.push(...subEncodings)
    } else throw Error('unknown condition type')
  } else if (input) { // assuming data exists, than it's just a value type
    // value
    if (isNaN(input)) {
      const color = new Color(input) // build the color as LCH
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(...color.getLCH()) // store that it is a value and than the values
    } else {
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(~~input) // store true as 1 and false as 0, otherwise it's a number
    }
  }
  // lastly store length of the current encoding
  encodings[0] += (encodings.length << 10)
  return encodings
}

// input ranges must encode an offset for each unknown (if a sub-condition exists)
// this means that if we come back with 3 new encodings for a specific zoom,
// than we need to preface that data with an offset of 3.
function parseInputRange (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  // Basically, since we don't know which zoom we will encounter,
  // we have to pre-run every case, and the decoder will also have to pre-run each one:
  const preSolutions = {}
  for (let i = 0, il = input.length; i < il; i += 2) {
    if (Array.isArray(input[i + 1])) {
      preSolutions[input[i]] = encodeFeatureFunction(input[i + 1])
    }
  }
  // now store all possible outcomes for sub conditionals
  return (properties, encoding) => {
    for (let key in preSolutions) {
      // get current state of encoding
      preSolutions[key](properties, encoding)
    }
  }
}

function parseDataRange (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  const key = input.shift() // key

  // first parse all possible conditionals
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = encodeFeatureFunction(input[c])
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

function parseDataCondition (input) {
  const conditions = []
  let encodeResultID = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      conditions.push({
        key: filter[0],
        encodeID: encodeResultID,
        condition: parseFilter(filter),
        result: encodeFeatureFunction(input.shift())
      })
      encodeResultID++
    } else if (input[0] === 'default') {
      input.shift() // 'default'
      conditions['default'] = encodeFeatureFunction(input.shift())
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

function encodeDataCondition (input) {
  const encoding = []
  let i = 1

  while (input.length) {
    const condition = input.shift()
    const value = input.shift()
    if (Array.isArray(condition)) {
      encoding.push(i, ...encodeLayerFunction(value))
    } else if (condition === 'default') {
      encoding.push(0, ...encodeLayerFunction(value))
    } else { throw new Error('unkown condition type') }
    i++
  }

  return encoding
}

function encodeRange (input) {
  const encoding = []

  while (input.length) {
    const condition = ~~input.shift() // convert true and false to 0 and 1 respectively
    const value = input.shift()
    encoding.push(condition, ...encodeLayerFunction(value))
  }

  return encoding
}

let trigger = 0

// function decodeFeature (conditionEncodings, featureEncoding, inputs, res, color, index = 0, featureIndex = 0) {
//   // prep variables
//   const startIndex = index
//   const featureIndexStart = featureIndex
//   const length = conditionEncodings[index] >> 10
//   const condition = (conditionEncodings[index] & 1008) >> 4
//   const inputType = (conditionEncodings[index] & 14) >> 1
//   const interpolationType = conditionEncodings[index] & 1
//   // console.log('index', index)
//   // console.log('length', length)
//   // console.log('condition', condition)
//   // console.log('inputType', inputType)
//   // console.log('interpolationType', interpolationType)
//   trigger++
//   if (trigger >= 10) return
//   index++
//   // create base, if exponential interpolation, we need to grab the base value and increment
//   let base = 1
//   if (interpolationType === 1) {
//     base = conditionEncodings[index]
//     index++
//   }
//   // run through conditions
//   if (condition === 1) { // value
//     for (let i = 0; i < length - 1; i++) res[i] = conditionEncodings[index + i]
//   } else if (condition === 2 || condition === 3) { // data-condition or input-condition
//     // run through each condition, when match is found, set value
//     let input, value
//     // setup input
//     if (condition === 2) {
//       input = featureEncoding[featureIndex]
//       featureIndex++
//     } else { input = inputs[inputType] }
//     // prep
//     value = conditionEncodings[index]
//     while (input !== value) {
//       // increment index & find length
//       index += (conditionEncodings[index + 1] >> 10) + 1
//       value = conditionEncodings[index]
//     }
//     // now we are in the proper place, we increment once and find grab the value
//     decodeFeature(conditionEncodings, featureEncoding, inputs, res, color, index + 1, featureIndex)
//   } else if (condition === 4 || condition === 5) { // data-range or input-range
//     let input, val1, val2, start, end
//     val1 = [-1, -1, -1, -1]
//     val2 = [-1, -1, -1, -1]
//     // grab the input value
//     if (condition === 4) {
//       input = featureEncoding[featureIndex]
//       featureIndex++
//     } else { input = inputs[inputType] }
//     // create a start point
//     start = end = conditionEncodings[index]
//     index++
//     // iterate through the current conditionalEncodings and match the indices with input
//     while (end < input && input < length) {
//       // console.log('START', end)
//       // console.log('INPUT', input)
//       const [newIndex, newFeatureIndex] = decodeFeature(conditionEncodings, featureEncoding, inputs, val1, color, index, featureIndex)
//       index = newIndex
//       // console.log('newIndex', index)
//       featureIndex = newFeatureIndex
//       // update end and index
//       start = end
//       end = conditionEncodings[index]
//       index++
//     }
//     // console.log('start', start)
//     // console.log('end', end)
//     // if input >= length than return val1
//     if (end === input) {
//       // console.log('A STORY')
//       // console.log()
//       decodeFeature(conditionEncodings, featureEncoding, inputs, res, color, index, featureIndex)
//     } else if (index >= length) { // just not found
//       // console.log('B STORY', val1)
//       // console.log()
//       res[0] = val1[0]; res[1] = val1[1]; res[2] = val1[2]; res[3] = val1[3]
//     } else if (val1[0] === -1) { // if val1 is still a negative number than decode start and set it to res
//       // console.log('C STORY')
//       // console.log()
//       decodeFeature(conditionEncodings, featureEncoding, inputs, res, color, index, featureIndex)
//     } else { // otherwise find val2, interpolate
//       // console.log('D STORY', index)
//       // console.log()
//       // console.log('end', end)
//       decodeFeature(conditionEncodings, featureEncoding, inputs, val2, color, index, featureIndex)
//       // console.log('val1', val1)
//       // console.log('val2', val2)
//       // get interpolation
//       const t = exponential(input, start, end, base) // default base of 1 makes a linear interpolation
//       if (color) interpolateColor(val1, val2, t, res)
//       else res[0] = val1[0] + t * (val2[0] - val1[0])
//     }
//   } else if (condition === 6) { // animation-state
//
//   } else if (condition >= 7) { // feature-state
//
//   }
//
//   return [startIndex + length, featureIndexStart + featureEncoding[featureIndexStart]]
// }

function decodeFeature (conditionEncodings, featureEncoding, inputs, color, index = 0, featureIndex = 0) {
  const res = new Float32Array([-1, -1, -1, -1])
  // prep variables
  const conditionStack = new Float32Array(6)
  let conditionIndex = 0
  // prep the first featureIndex
  conditionStack[conditionIndex] = conditionEncodings[index]
  conditionIndex++
  index++

  do {
    conditionIndex--
    // pull out current conditionIndex condition an decode
    const conditionSet = conditionStack[conditionIndex]
    const length = conditionSet >> 10
    const condition = (conditionSet & 1008) >> 4
    // for each following condition, pull out the eventual color and set to val
    if (condition === 1) {
      if (res[0] !== -1) { // blend with current value
        // const t = exponential(input, start, end, base)
        const val = [conditionEncodings[index], conditionEncodings[index + 1], conditionEncodings[index + 2], conditionEncodings[index + 3]]
        if (color) res = interpolateColor(res, val, t)
        else res[0] = res[0] + t * (val[0] - res[0])
      } else {
        for (let i = 0; i < length - 1; i++) res[i] = conditionEncodings[index + i]
      }
      index += length // increment where we are in the total conditionEncodings
    } else if (condition === 2 || condition === 3) { // data-condition & input-condition
      // get the input from either featureEncoding or inputs
      let input, conditionInput
      if (condition === 2) {
        input = featureEncoding[featureIndex]
        featureIndex++
      } else { input = inputs[(conditionSet & 14) >> 1] }
      // now that we have the input, we iterate through and find a match
      conditionInput = conditionEncodings[index]
      while (input !== conditionInput) {
        // increment index & find length
        index += (conditionEncodings[index + 1] >> 10) + 1
        conditionInput = conditionEncodings[index]
      }
      index++ // increment to conditionEncoding
      // now parse subCondition
      conditionStack[conditionIndex] = conditionEncodings[index]
      conditionIndex++ // increment size of conditionIndex
      index++ // increment to actual input set
    } else if (condition === 4 || condition === 5) { // data-range & input-range
      // get interpolation & base
      interpolationType = conditionSet & 1
      base = 1
      if (interpolationType === 1) {
        base = conditionEncodings[index]
        index++
      }
      // find the two values and run them
      let input, start, end, subCondition
      // grab the input value
      if (condition === 4) {
        input = featureEncoding[featureIndex]
        featureIndex++
      } else { input = inputs[inputType] }
      // create a start point
      start = end = conditionEncodings[index]
      index++
      subCondition = (conditionEncodings[index] & 1008) >> 4
      if (subCondition === 2 || subCondition === 4) featureIndex++
      // iterate through the current conditionalEncodings and match the indices with input
      while (end < input && input < length) {
        // update end and index
        start = end
        end = conditionEncodings[index]
        index++
        // get actual condition
        subCondition = (conditionEncodings[index] & 1008) >> 4
        if (subCondition === 2 || subCondition === 4) featureIndex++
      }
      // if input >= length than return val1
      if (end === input) {
        // console.log('A STORY')
        // console.log()
        // decodeFeature(conditionEncodings, featureEncoding, inputs, res, color, index, featureIndex)
      } else if (index >= length) { // just not found
        // console.log('B STORY', val1)
        // console.log()
        res[0] = val1[0]; res[1] = val1[1]; res[2] = val1[2]; res[3] = val1[3]
      } else if (val1[0] === -1) { // if val1 is still a negative number than decode start and set it to res
        // console.log('C STORY')
        // console.log()
        // decodeFeature(conditionEncodings, featureEncoding, inputs, res, color, index, featureIndex)
      } else { // otherwise find val2, interpolate
        // console.log('D STORY', index)
        // console.log()
        // console.log('end', end)
        // decodeFeature(conditionEncodings, featureEncoding, inputs, val2, color, index, featureIndex)
        // console.log('val1', val1)
        // console.log('val2', val2)
        // get interpolation
        // const t = exponential(input, start, end, base) // default base of 1 makes a linear interpolation
        // if (color) interpolateColor(val1, val2, t, res)
        // else res[0] = val1[0] + t * (val2[0] - val1[0])
      }
    }
  } while (conditionIndex > 0)

  return res
}

// CONDITION ENCODINGS: 128 positions possible, although if you're using more than 2 or 3 feature-states, you may need to rethink your design
// 0 -> null
// 1 -> value
// 2 -> data-condition
// 3 -> input-condition
// 4 -> data-range
// 5 -> input-range
// 6 -> animation-state
// 7+ -> feature-state

// INPUT RANGE/CONDITION ENCODINGS:
// 0 -> zoom
// 1 -> lat
// 2 -> lon
// 3 -> angle
// 4 -> pitch

// INTERPOLATION ENCODINGS: data-ranges or input-ranges have either linear or exponential interpolations
// if exponential the base must also be encoded, after the type
// 0 -> linear
// 1 -> exponential

// interpolation type: input & 1
// input range: (input & 14) >> 1
// input condition: (input & 1008) >> 4
// length: input >> 10

function interpolateColor (val1, val2, t) {
  // prep variables
  let sat, hue, lbv, dh, alpha
  let [hue0, sat0, lbv0, alpha0] = val1
  let [hue1, sat1, lbv1, alpha1] = val2
  // first manage hue
  if (!isNaN(hue0) && !isNaN(hue1)) {
    if (hue1 > hue0 && hue1 - hue0 > 180) dh = hue1 - (hue0 + 360)
    else if (hue1 < hue0 && hue0 - hue1 > 180) dh = hue1 + 360 - hue0
    else dh = hue1 - hue0
    hue = hue0 + t * dh
  } else if (!isNaN(hue0)) {
    hue = hue0
    if (lbv1 == 1 || lbv1 == 0) sat = sat0
  } else if (!isNaN(hue1)) {
    hue = hue1
    if (lbv0 == 1 || lbv0 == 0) sat = sat1
  } else {
    hue = null
  }
  // saturation
  if (!sat) sat = sat0 + t * (sat1 - sat0)
  // luminosity
  lbv = lbv0 + t * (lbv1 - lbv0)
  // alpha
  alpha = alpha0 + t * (alpha1 - alpha0)
  // create the new color
  return [hues, sat, lbv, alpha]
}

function getEasingFunction(zoomType, base = 1) {
  const func = (zoomType === 'lin')
    ? linear
    : (zoomType === 'expo')
      ? exponential
      : (zoomType === 'quad')
        ? quad
        : (zoomType === 'cubic')
          ? cubic
          : step
  return (zoom, start, end, startValue, endValue) => {
    const t = func(zoom, start, end, base)
    if (isNaN(startValue)) { // we are dealing with colors
      return Color.interpolate(startValue, endValue, t)
    } else { // perhaps line-width or some other number value; Given our t depth, convert to a new value
      return startValue + t * (endValue - startValue)
    }
  }
}

// y = mx
function linear (input, start, end) {
  return (input - start) / (end - start)
}

// y = e^x OR y = Math.pow(2, 10 * x)
function exponential (input, start, end, base) {
  // grab change
  const diff = end - start
  if (diff === 0) return 0
  // refine base value
  if (base <= 0) base = 0.1
  else if (base > 2) base = 2
  // grab diff
  const progress = input - start
  // linear case
  if (base === 1) return progress / diff
  // solve
  return (Math.pow(base, progress) - 1) / (Math.pow(base, diff) - 1)
}

// y = x^2
function quad (input, start, end) {
  return Math.pow(input - start, 2) / Math.pow(end - start, 2)
}

// y = x^3
function cubic (input, start, end) {
  return Math.pow(input - start, 3) / Math.pow(end - start, 3)
}

function step (input, start, end) {
  return 0 // will default to start
}

exports.default = {
  encodeFeatureFunction,
  encodeLayerFunction,
  decodeFeature
}
