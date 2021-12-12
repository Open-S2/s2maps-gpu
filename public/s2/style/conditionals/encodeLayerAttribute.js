// @flow
import Color from '../color'

// CONDITION ENCODINGS: 128 positions possible
// 0 -> null
// 1 -> value
// 2 -> data-condition
// 3 -> input-condition
// 4 -> data-range
// 5 -> input-range
// 6 -> feature-state (this updates for each draw assuming the feature has a "feature-state")
// 7 -> animation-state (this updates for each draw assuming the feature has a "animation-state")

// FEATURE-STATE ENCODINGS:
// 0 -> default (inactive)
// 1 -> hover
// 2 -> active

// INPUT RANGE/CONDITION ENCODINGS:
// 0 -> zoom
// 1 -> lon
// 2 -> lat
// 3 -> angle
// 4 -> pitch
// 5 -> time

// INTERPOLATION ENCODINGS: data-ranges or input-ranges have either linear or exponential interpolations
// if exponential the base must also be encoded, after the type
// 0 -> linear
// 1 -> exponential

// This functionality is built for webgl to parse for drawing
// The Style object will parse all layers' attributes like "color", "fill", "width", etc.
// The code will be placed into "LayerCode" for the GPU shader to parse as necessary.
export default function encodeLayerAttribute (input: Array<any>, lch: boolean = false): Float32Array {
  const encodings = []
  encodings.push(0) // store a null no matter what
  if (Array.isArray(input)) { // conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      // set the condition bits as data-condition
      encodings[0] += (2 << 4)
      // encode the condition type
      encodings.push(...encodeDataCondition(input, lch))
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
      // encode range data and store
      encodings.push(...encodeRange(input, lch))
    } else if (conditionType === 'input-range') {
      // set the condition bits as input-range
      encodings[0] += (5 << 4)
      // encode the input-range type
      const inputRangeType = input.shift()
      if (inputRangeType === 'zoom') encodings[0] += (0 << 1)
      else if (inputRangeType === 'lon') encodings[0] += (1 << 1)
      else if (inputRangeType === 'lat') encodings[0] += (2 << 1)
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
      // encode range data and store
      encodings.push(...encodeRange(input, lch))
    } else if (conditionType === 'feature-state') {
      // set the condition bits as feature-state
      encodings[0] += (6 << 4)
      // encode the feature-states and store
      encodings.push(...encodeFeatureStates(input, lch))
    } else throw Error('unknown condition type')
  } else if (input || input === 0) { // assuming data exists, than it's just a value type
    // value
    if (isNaN(input)) {
      const color = new Color(input) // build the color as RGB or LCH
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(...((lch) ? color.getLCH() : color.getRGB())) // store that it is a value and than the values
    } else {
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(input) // store true as 1 and false as 0, otherwise it's a number
    }
  }
  // lastly store length of the current encoding
  encodings[0] += (encodings.length << 10)
  return new Float32Array(encodings)
}

function encodeDataCondition (input: Array<any>, lch: boolean): Array<number> {
  const encoding = []
  let i = 1

  while (input.length) {
    const condition = input.shift()
    const value = input.shift()
    if (Array.isArray(condition)) {
      encoding.push(i, ...encodeLayerAttribute(value, lch))
    } else if (condition === 'default') {
      encoding.push(0, ...encodeLayerAttribute(value, lch))
    } else { throw new Error('unkown condition type') }
    i++
  }

  return encoding
}

function encodeRange (input: Array<any>, lch: boolean): Array<number> {
  const encoding = []

  while (input.length) {
    const condition = input.shift()
    const value = input.shift()
    encoding.push(condition, ...encodeLayerAttribute(value, lch))
  }

  return encoding
}

function encodeFeatureStates (input: Array<any>, lch: boolean): Array<number> {
  const encoding = []

  while (input.length) {
    // get condition name
    const condition = input.shift()
    const conditionCode = (condition === 'default')
      ? 0 // (inactive)
      : (condition === 'hover')
          ? 1
          : (condition === 'active')
              ? 2
              : 0 // default / inactive
    // get condition
    const value = input.shift()
    encoding.push(conditionCode, ...encodeLayerAttribute(value, lch))
  }

  return encoding
}
