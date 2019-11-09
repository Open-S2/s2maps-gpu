// @flow
import {
  parseConditionEncode,
  parseConditionDecode,
  parseFilter,
  getEasingFunction
} from './'

import type { EaseType } from './easingFunctions'

// consider two cases:
// one: the data condition results in a color
// two: the data condition results in another conditional
// examples:
// { "color": [
//    "data-condition",
//    ["class", "==", "ocean"],
//    "rgba(5, 100, 125, 255)",
//    ["class", "==", "river"],
//    ["zoom-condition", "linear", 0, "rgba(0, 0, 0, 0)", 5, "rgba(5, 100, 125, 200)", 10, "rgba(20, 130, 200, 255)"]],
//    "default"
//    null
// ]}

// if this function was called, input[0] has already been shifted and "data-condition" has been removed
export function encodeDataConditionFunction (input: Array<string | Array<any> | null>): Function {
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

export function decodeDataConditionFunction (input: Array<string | Array<any> | null>): Function {
  const conditions = {}
  let i = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      input.shift() // the filter
      conditions[i] = parseConditionDecode(input.shift())
      i++
    } else if (input[0] === 'default') {
      input.shift() // default
      conditions[0] = parseConditionDecode(input.shift())
    }
  }
  if (!conditions[0]) conditions[0] = () => null // just incase it's missing in the style json
  return (encodings) => {
    const code = encodings.shift()
    return conditions[code](encodings)
  }
}

export function encodeDataRangeFunction (input: Array<string | Array<any> | null>): Function {
  // grab function type
  const easeType: EaseType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  const key = input.shift() // key

  // first parse all possible conditionals
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionEncode(input[c])
    c += 2
  }

  return (properties: Object, encoding: Array<number>) => {
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
      input[i - 1](properties, encoding) // get first inputs encodings should we need it
      // if equal to start, then we don't need to store the next encoding, we never reach it
      if (startRange === dataInput) return
      input[i + 1](properties, encoding)
      return
    }
  }
}

export function decodeDataRangeFunction (input: Array<string | Array<any> | null>): Function {
  // grab function type
  const easeType: EaseType = input.shift()
  const base = (easeType === 'expo') ? input.shift() : null
  input.shift() // key

  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionDecode(input[c])
    c += 2
  }

  // first ensure each result property is parsed:
  return (encodings: Array<number>) => {
    const code = encodings.shift()

    if (code <= input[0]) {
      return input[1](encodings)
    } else if (code >= input[input.length - 2]) {
      return input[input.length - 1](encodings)
    } else {
      const easeFunction = getEasingFunction(easeType, base)
      let i = 0
      while (input[i] <= code) i += 2
      // now we know the code is inbetween input[i - 2][0] and input[i - 1][0]
      const start = input[i - 2]
      const startValue = input[i - 1](encodings)
      if (start === code) return startValue
      const end = input[i]
      const endValue = input[i + 1](encodings)
      // now we interpolate
      return easeFunction(code, start, end, startValue, endValue)
    }
  }
}
