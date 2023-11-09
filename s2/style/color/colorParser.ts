export type ColorDefinition = [encoding: string, colors: [r: number, g: number, b: number, a: number]]

// there are three types of strings to parse
// color names: 'red', 'black', etc
// Hex: #ededed
// type encodings:
// rgb(255, 255, 255)
// rgba(255, 255, 255, 255)
// hsv(180, 0.9, 0.7843137254901961)
// hsva(180, 0.9, 0.7843137254901961, 1)

const colorNames = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow']
const colorValues = [0x00FFFF, 0x000000, 0x0000FF, 0xFF00FF, 0x808080, 0x008000, 0x00FF00, 0x800000, 0x000080, 0x808000, 0xFFA500, 0x800080, 0xFF0000, 0xC0C0C0, 0x008080, 0xFFFFFF, 0xFFFF00]

export default function colorParser (input: string): ColorDefinition {
  if (colorNames.includes(input)) {
    const u = colorValues[colorNames.indexOf(input)]
    const r = u >> 16
    const g = (u >> 8) & 0xFF
    const b = u & 0xFF
    return ['rgb', [r, g, b, 1]]
  } else if (input[0] === '#') { // hex encoding
    return parseHex(input)
  } else {
    return parseString(input)
  }
}

function parseHex (input: string): ColorDefinition {
  input = input.substring(1)
  // shorthand notation
  if (input.length % 3 === 0) {
    if (input.length === 3) {
      const sub = input.split('')
      input = sub[0] + sub[0] + sub[1] + sub[1] + sub[2] + sub[2]
    }
    const u = parseInt(input, 16)
    const r = u >> 16
    const g = (u >> 8) & 0xFF
    const b = u & 0xFF
    return ['rgb', [r, g, b, 1]]
  } else if (input.length % 4 === 0) {
    if (input.length === 4) {
      const sub = input.split('')
      input = sub[0] + sub[0] + sub[1] + sub[1] + sub[2] + sub[2] + sub[3] + sub[3]
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

function parseString (input: string): ColorDefinition {
  // seperate type and values
  let [type, values] = input.split('(')
  // cleanup values & parse numbers
  const nums = values.split(')')[0].split(',').map(Number)
  // if no alpha type present, add alpha number
  if (type.length === 3) {
    nums.push(1)
  } else {
    // remove extra character for Color class
    type = type.slice(0, -1)
    // ensure the alpha value is between 0 and 1
    if (nums[3] > 1) nums[3] /= 255
  }
  return [type, [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 0]]
}
