// @flow
import {
  encodeFeatureFunction
} from './'

/**
consider two cases:
one: the data condition results in a color
two: the data condition results in another conditional
// examples:
{ "color": [
    "data-range",
    "lin",
    "elev",
    0,
    "rgba(5, 100, 125, .5)",
    5,
    "rgba(20, 130, 200, 0.75)",
    7,
    "rgba(30, 180, 230, 0.8)"
  ]
}
**/

export default function parseDataRange (input) {
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
      // we don't need the value returned, but potentially we need to encode sub conditions
      input[i - 1](properties, encoding)
      // if equal to start, then we don't need to store the next encoding, we never reach it
      if (startRange === dataInput) return
      input[i + 1](properties, encoding)
      return
    }
  }
}
