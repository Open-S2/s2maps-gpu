// @flow
import Color from '../color'
import {
  encodeDataConditionFunction,
  encodeDataRangeFunction,
  decodeDataConditionFunction,
  decodeDataRangeFunction,
  encodeZoomRangeFunction,
  decodeZoomRangeFunction
} from './'

/**
// consider data (feature property) based inputs
// because the Web Worker processes the features and only sends back the trianges, we have to
// encode the data conditions for parsing for the webworker, and than send the results over
// to the draw thread to parse again for color/number. To put it in simpler terms, we need the "answers"
// to the data based conditionals sent to the draw thread.

// NOTE: For the decode parsing: Since all data based inputs are static, upon first call
// the function self simplifies down to a color or zoom function should it exist.

// example:
{ "color": [
     "data-condition",
     ["class", "==", "ocean"],
     "rgba(5, 100, 125, 255)",
     ["class", "==", "river"],
     "rgba(20, 130, 200, 255)",
     "default"
     null
  ],
  "line-width": [
     "data-condition",
     ["class", "==", "ocean"],
     15,
     ["class", "==", "river"],
     ["data-condition", ["elev", "==", 5], 10, "default", 7],
     "default"
     ["zoom-condition", "lin", 3, 5, 7, 10]
  ]
}

// PARSED WEBWORKER:
// NOTE: default is ALWAYS 0
{ 0: [
     "data-condition",
     ["class", "==", "ocean"],
     1,
     ["class", "==", "river"],
     2,
     "default"
     0
  ],
  1: [
     "data-condition",
     ["class", "==", "ocean"],
     1,
     ["class", "==", "river"],
     2: ["data-condition", ["elev", "==", 5], 1, "default", 0],
     "default"
     0: ["zoom-condition", "lin", 3, 5, 7, 10]
  ]
}

The returned data assuming 2 features, the first with class value of "ocean" and
the second with class value "river" with elev of "5"
[4 (size), indicesSize, indicesOffset, 0, 1, 1, 1, x (size), indicesSize, indicesOffset, 0, 2, 1, 2, 1]

// PARSED DRAW THREAD:
// NOTE: default is ALWAYS 0; ALSO, ask you run through layout | color, the property keys will run in order, so in  the example case, color comes first
// while line-width is second (0, and 1 respectively)
// second parsing:
{ "color": [
     "data-condition",
     1,
     "rgba(5, 100, 125, 255)",
     2,
     "rgba(20, 130, 200, 255)",
     0
     null
  ],
  "line-width": [
     "data-condition",
     1,
     15,
     2,
     ["data-condition", 1, 10, 0, 7],
     "default"
     ["zoom-condition", "lin", ]
  ]
}

// how it will work:
{
  0: {
    0: null,
    1: "rgba(5, 100, 125, 255)",
    2: "rgba(20, 130, 200, 255)"
  },
  1: {
    0: 7,
    1: 15,
    2: {
      0: (zoom) => easingFunc(...inputs),
      1; 10
    }
  }
}
**/

// This functionality is built for the Web Worker
export function parseConditionEncode (input) {
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

// This functionality is built for the draw thread
export function parseConditionDecode (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = decodeDataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = decodeDataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-range') {
      const parsedZoomFunction = decodeZoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => { return () => null } }
  } else {
    if (isNaN(input)) {
      const color = new Color(input)
      return () => color
    } else { return () => input }
  }
}
