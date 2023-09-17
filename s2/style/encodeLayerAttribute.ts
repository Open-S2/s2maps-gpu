import Color from './color'

import type {
  DataCondition,
  DataRange,
  FeatureState,
  InputRange,
  NotNullOrObject,
  NumberColor,
  Property,
  ValueType
} from './style.spec'

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
// 3 -> selected
// 4 -> disabled

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
// 2 -> quad-bezier
// 3 -> cubic-bezier
// 4 -> step

// This functionality is built for webgl to parse for drawing
// The Style object will parse all layers' attributes like "color", "fill", "width", etc.
// The code will be placed into "LayerCode" for the GPU shader to parse as necessary.
export default function encodeLayerAttribute<T extends NotNullOrObject> (
  input: ValueType<T> | Property<ValueType<T>>,
  lch: boolean
): number[] {
  const encodings: number[] = []
  encodings.push(0) // store a null no matter what
  if (typeof input === 'object') { // conditional
    if ('dataCondition' in input && input.dataCondition !== undefined) {
      // set the condition bits as data-condition
      encodings[0] += (2 << 4)
      // encode the condition type
      encodings.push(...encodeDataCondition<T>(input.dataCondition, lch))
    } else if ('dataRange' in input && input.dataRange !== undefined) {
      const { dataRange } = input
      const { ease } = dataRange
      // set the condition bits as data-range
      encodings[0] += (4 << 4)
      // encode the interpolation type
      if (ease === 'expo') encodings[0] += 1
      // encode range data and store
      encodings.push(...encodeRange<T>(dataRange, lch))
    } else if ('inputRange' in input && input.inputRange !== undefined) {
      const { inputRange } = input
      const { type, ease } = inputRange
      // set the condition bits as input-range
      encodings[0] += (5 << 4)
      // encode the input-range type
      if (type === 'zoom') encodings[0] += (0 << 1)
      else if (type === 'lon') encodings[0] += (1 << 1)
      else if (type === 'lat') encodings[0] += (2 << 1)
      else if (type === 'angle') encodings[0] += (3 << 1)
      else if (type === 'pitch') encodings[0] += (4 << 1)
      // encode the interpolation type (ONLY expo takes a base)
      if (ease === 'expo') encodings[0] += 1
      // encode range data and store
      encodings.push(...encodeRange<T>(input.inputRange, lch))
    } else if ('featureState' in input && input.featureState !== undefined) {
      // set the condition bits as feature-state
      encodings[0] += (6 << 4)
      // encode the feature-states and store
      encodings.push(...encodeFeatureStates<T>(input.featureState, lch))
    } else throw Error('unknown condition type')
  } if (input !== undefined && input !== null) { // assuming data exists, than it's just a value type
    // value
    if (typeof input === 'string') {
      const color = new Color(input) // build the color as RGB or LCH
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(...((lch) ? color.getLCH() : color.getRGB())) // store that it is a value and than the values
    } else {
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(input as number) // store true as 1 and false as 0, otherwise it's a number
    }
  }
  // lastly store length of the current encoding
  encodings[0] += (encodings.length << 10)
  return encodings
}

function encodeDataCondition<T extends NotNullOrObject> ({ conditions, fallback }: DataCondition<ValueType<T>>, lch: boolean): number[] {
  const encoding = []
  let i = 1

  for (const { input } of conditions) {
    encoding.push(i, ...encodeLayerAttribute(input, lch))
    i++
  }
  encoding.push(0, ...encodeLayerAttribute(fallback, lch))

  return encoding
}

function encodeRange<T> ({ base, ranges }: DataRange<NumberColor<T>> | InputRange<NumberColor<T>>, lch: boolean): number[] {
  const encoding = []

  encoding.push(base ?? 1)

  for (const { stop, input } of ranges) {
    encoding.push(stop, ...encodeLayerAttribute(input, lch))
  }

  return encoding
}

function encodeFeatureStates<T extends NotNullOrObject> ({ condition, input }: FeatureState<ValueType<T>>, lch: boolean): number[] {
  const encoding = []

  const conditionCode = (condition === 'default')
    ? 0 // (inactive)
    : (condition === 'hover')
        ? 1
        : (condition === 'active')
            ? 2
            : 0 // default / inactive
  // store condition
  encoding.push(conditionCode, ...encodeLayerAttribute(input, lch))

  return encoding
}
