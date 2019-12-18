// @flow
import {
  encodeFeatureFunction
} from './'

/**
consider two cases:
one: the zoom condition results in a color
two: the zoom condition results in another conditional
// examples:
// { color: [
//    "input-range",
//    "zoom",
//    "lin",
//    0,
//    "rgba(5, 100, 125, 255)",
//    5,
//    ["data-condition", ["class", "==", "river"], "rgba(5, 100, 125, 200)", ["class", "==", "ocean"], "rgba(20, 130, 200, 255)", "default": "rgba(20, 130, 200, 255)"]],
// }
**/

// input ranges must encode an offset for each unknown (if a sub-condition exists)
// this means that if we come back with 3 new encodings for a specific zoom,
// than we need to preface that data with an offset of 3.
export default function parseInputRange (input) {
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
