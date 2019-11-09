// @flow
import {
  parseConditionEncode,
  parseConditionDecode,
  getEasingFunction
} from './'

import type { EaseType } from './easingFunctions'

// consider two cases:
// one: the zoom condition results in a color
// two: the zoom condition results in another conditional
// examples:
// { color: [
//    "zoom-condition",
//    "lin"
//    0,
//    "rgba(5, 100, 125, 255)",
//    5,
//    ["data-condition", ["class", "==", "river"], "rgba(5, 100, 125, 200)", ["class", "==", "ocean"], "rgba(20, 130, 200, 255)", "default": "rgba(20, 130, 200, 255)"]],
// }

export function encodeZoomRangeFunction (input: Array<string | Array<any> | null>): Function {
  // grab function type
  const easeType: EaseType = input.shift() // remove ease type
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
  return (properties: Object, encoding: Array<number>) => {
    for (let key in preSolutions) {
      preSolutions[key](properties, encoding)
    }
  }
}

export function decodeZoomRangeFunction (input: Array<string | Array<any> | null>): Function {
  // grab function type
  const easeType: EaseType = input.shift()
  const base = (easeType === 'expo') ? input.shift() : null
  const easeFunction = getEasingFunction(easeType, base)

  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionDecode(input[c])
    c += 2
  }

  // first ensure each result property is parsed:
  return (encodings: Array<number>) => {
    let c = 1
    let il = input.length
    while (c < il) {
      input[c] = input[c](encodings)
      c += 2
    }

    return (zoom: number) => {
      if (zoom <= input[0]) {
        return input[1]
      } else if (zoom >= input[input.length - 2]) {
        return input[input.length - 1]
      } else {
        let i = 0
        while (input[i] <= zoom) i += 2
        // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
        const startZoom = input[i - 2]
        const startValue = input[i - 1]
        if (startZoom === zoom) return startValue
        const endZoom = input[i]
        const endValue = input[i + 1]
        // now we interpolate
        return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
      }
    }
  }
}
