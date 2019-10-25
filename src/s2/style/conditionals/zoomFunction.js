// @flow
import Color from '../color'
import parseCondition from './parseCondition'

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

type ZoomType = 'lin' | 'expo' | 'cubic' | 'step'

// these functions prep a getter function for change of zoom for color and opacity changes
export default function zoomFunction (input: Array<string | Array<any> | null>) {
  // grab function type
  const zoomType: ZoomType = input.shift()
  const zoomFunction = getZoomFunction(zoomType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseCondition(input[c])
    c += 2
  }

  return (properties: Object, zoom: number) => {
    if (zoom <= input[0][0]) {
      return input[0][1]
    } else if (zoom >= input[input.length - 1][0]) {
      return input[input.length - 1][1]
    } else {
      let i = 1
      while (zoom <= input[i][0]) i++
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = input[i - 2][0]
      const endZoom = input[i - 1][0]
      const startColor = input[i - 2][1](properties, zoom)
      const endColor = input[i - 1][1](properties, zoom)
      // now we interpolate
      zoomFunction(zoom, startZoom, endZoom, startColor, endColor)
    }
  }
}

function getZoomFunction(zoomType: ZoomType) {
  const func = (zoomType === 'lin')
    ? linear
    : (zoomType === 'expo')
      ? exponential
      : (zoomType === 'cubic')
        ? cubicBezier
        : step
  return (zoom, start, end, startColor, endColor) => func(zoom, start, end, startColor, endColor)
}

function linear (zoom: number, start: number, end: number, startColor: Color, endColor: Color) {

}

function exponential (zoom: number, start: number, end: number, startColor: Color, endColor: Color) {

}

function cubicBezier (zoom: number, start: number, end: number, startColor: Color, endColor: Color) {

}

function step (zoom: number, start: number, end: number, startColor: Color, endColor: Color) {
  return startColor
}
