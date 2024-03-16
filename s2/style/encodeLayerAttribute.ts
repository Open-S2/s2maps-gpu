import Color from './color'

import type {
  DataCondition,
  DataRangeEase,
  DataRangeStep,
  FeatureState,
  InputRangeEase,
  InputRangeStep,
  NotNullOrObject,
  NumberColor,
  Property,
  ValueType
} from './style.spec'

/**
 * This encoder is built for webgl/webgpu to parse for conditional drawing.
 * The Style object will parse all layers' attributes like "color", "fill", "width", etc.
 * The code will be placed into "LayerCode" for the GPU shader to utiilize as necessary.
 *
 * CONDITION ENCODINGS: 128 positions possible
 * 0 -> null
 * 1 -> value
 * 2 -> data-condition
 * 3 -> input-condition
 * 4 -> data-range
 * 5 -> input-range
 * 6 -> feature-state (this updates for each draw assuming the feature has a "feature-state")
 * 7 -> animation-state (this updates for each draw assuming the feature has a "animation-state")
 * 8 -> input-value (this is a constant value pulled from properties)
 *
 * FEATURE-STATE ENCODINGS:
 * 0 -> default (inactive)
 * 1 -> hover
 * 2 -> active
 * 3 -> selected
 * 4 -> disabled
 *
 * INPUT RANGE/CONDITION ENCODINGS:
 * 0 -> zoom
 * 1 -> lon
 * 2 -> lat
 * 3 -> angle
 * 4 -> pitch
 * 5 -> time
 *
 * INTERPOLATION ENCODINGS: data-ranges or input-ranges have either linear or exponential interpolations
 * if exponential the base must also be encoded, after the type
 * 0 -> linear
 * 1 -> exponential
 * 2 -> quad-bezier
 * 3 -> cubic-bezier
 * 4 -> step
 */
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
    } else if ('inputCondition' in input && input.inputCondition !== undefined) {
      // set the condition bits as input-condition
      encodings[0] += (3 << 4)
      // TODO: encode the condition type correctly
    } else if ('dataRange' in input && input.dataRange !== undefined) {
      const { dataRange } = input
      const { base, ease } = dataRange
      // set the condition bits as data-range
      encodings[0] += (4 << 4)
      // encode the interpolation type
      if (ease === 'expo') {
        encodings[0] += 1
        encodings.push(base ?? 1)
      }
      // encode range data and store
      encodings.push(...encodeRange<T>(dataRange, lch))
    } else if ('inputRange' in input && input.inputRange !== undefined) {
      const { inputRange } = input
      const { type, ease, base } = inputRange
      // set the condition bits as input-range
      encodings[0] += (5 << 4)
      // encode the input-range type
      if (type === 'zoom') encodings[0] += (0 << 1)
      else if (type === 'lon') encodings[0] += (1 << 1)
      else if (type === 'lat') encodings[0] += (2 << 1)
      else if (type === 'angle') encodings[0] += (3 << 1)
      else if (type === 'pitch') encodings[0] += (4 << 1)
      // encode the interpolation type (ONLY expo takes a base)
      if (ease === 'expo') {
        encodings[0] += 1
        encodings.push(base ?? 1)
      }
      // encode range data and store
      encodings.push(...encodeRange<T>(inputRange, lch))
    } else if ('featureState' in input && input.featureState !== undefined) {
      // set the condition bits as feature-state
      encodings[0] += (6 << 4)
      // encode the feature-states and store
      encodings.push(...encodeFeatureStates<T>(input.featureState, lch))
    } else if ('inputValue' in input && input.inputValue !== undefined) {
      // set the condition bits as input-condition
      encodings[0] += (8 << 4)
    } else throw Error('unknown condition type')
  } else if (input !== undefined && input !== null) { // assuming data exists, than it's just a value type
    // value
    if (typeof input === 'string') {
      const color = new Color(input) // build the color as RGB or LCH
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(...((lch) ? color.getLCH() : color.getRGB())) // store that it is a value and than the values
    } else if (typeof input === 'number') {
      encodings[0] += (1 << 4) // set the condition bits as 1 (value)
      encodings.push(input) // store true as 1 and false as 0, otherwise it's a number
    } else throw Error('unknown condition type')
  }
  // lastly store length of the current encoding
  encodings[0] += (encodings.length << 10)
  return encodings
}

function encodeDataCondition<T extends NotNullOrObject> (
  { conditions, fallback }: DataCondition<ValueType<T>>,
  lch: boolean
): number[] {
  const encoding: number[] = []
  let i = 1

  for (const { input } of conditions) {
    encoding.push(i, ...encodeLayerAttribute(input, lch))
    i++
  }
  encoding.push(0, ...encodeLayerAttribute(fallback, lch))

  return encoding
}

function encodeRange<T> (
  { ranges }: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>> | InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>,
  lch: boolean
): number[] {
  const encoding: number[] = []

  for (const { stop, input } of ranges) {
    encoding.push(stop, ...encodeLayerAttribute(input, lch))
  }

  return encoding
}

function encodeFeatureStates<T extends NotNullOrObject> (
  { condition, input }: FeatureState<ValueType<T>>,
  lch: boolean
): number[] {
  const encoding: number[] = []

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
