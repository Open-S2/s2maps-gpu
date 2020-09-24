// @flow
// https://www.nature.com/articles/nmeth.1618

import type Color from './color'

const colors = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  orange: [230, 159, 0],
  skyBlue: [86, 180, 233],
  blueGreen: [0, 158, 115],
  yellow: [240, 228, 66],
  blue: [0, 114, 178],
  vermillion: [213, 94, 0],
  redPurple: [204, 121, 167]
}

export default function colorBlindAdjust (color: Color) {
  // ensure we are using RGB and grab the values
  color.toRGB()
  const { val } = color
  // if red, green, and blue are even, we don't need to adjust
  if (val[0] === val[1] && val[0] === val[2]) return
  // check against the safe 7 color spectrum and move towards closest color
  let closestName = 'black'
  let closestTotal = Infinity
  for (const name in colors) {
    const curColor = colors[name]
    const total = Math.abs(curColor[0] - val[0]) + Math.abs(curColor[1] - val[1]) + Math.abs(curColor[2] - val[2])
    if (total < closestTotal) {
      closestTotal = total
      closestName = name
    }
  }
  // now we know which color we are closest to, we shift towards that color:
  const closest = colors[closestName]
  color.val[0] = (val[0] + closest[0]) / 2
  color.val[1] = (val[1] + closest[1]) / 2
  color.val[2] = (val[2] + closest[2]) / 2
}
