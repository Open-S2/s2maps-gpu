// @flow
// there are two types of strings to parse
// Hex: #ededed
// type encodings:
// rgb(255, 255, 255)
// rgba(255, 255, 255, 255)
// hsv(180, 0.9, 0.7843137254901961)
// hsva(180, 0.9, 0.7843137254901961, 1)
export default function colorParser (input: string): [string, [number, number, number, number]] {
  if (input[0] === '#') { // hex encoding
    return parseHex(input)
  } else {
    return parseString(input)
  }
}

function parseHex (input: string): [string, [number, number, number, number]] {
  input = input.substr(1)
  // shorthand notation
  if (input.length % 3 === 0) {
    if (input.length === 3) {
      input = input.split('')
      input = input[0] + input[0] + input[1] + input[1] + input[2] + input[2]
    }
    const u = parseInt(input, 16)
    const r = u >> 16
    const g = (u >> 8) & 0xFF
    const b = u & 0xFF
    return ['rgb', [r, g, b, 1]]
  } else if (input.length % 4 === 0) {
    if (input.length === 4) {
      input = input.split('')
      input = input[0] + input[0] + input[1] + input[1] + input[2] + input[2] + input[3] + input[3]
    }
    const u = parseInt(input, 16)
    const r = (u >> 24) & 0xFF
    const g = (u >> 16) & 0xFF
    const b = (u >> 8) & 0xFF
    const a = Math.round((u & 0xFF) / 0xFF * 100) / 100
    return ['rgb', [r, g, b, a]]
  } else {
    return ['rgb', [0, 0, 0, 0]]
  }
}

function parseString (input): [string, [number, number, number, number]] {
  // seperate type and values
  let [type, values] = input.split('(')
  // cleanup values & parse numbers
  values = values.split(')')[0].split(',').map(Number)
  // if no alpha type present, add alpha number
  if (type.length === 3) {
    values.push(1)
  } else {
    // remove extra character for Color class
    type = type.slice(0, -1)
    // ensure the alpha value is between 0 and 1
    if (values[3] > 1) values[3] /= 255
  }
  return [type, [values[0] || 0, values[1] || 0, values[2] || 0, values[3] || 0]]
}
