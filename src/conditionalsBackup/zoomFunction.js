// @flow
const Color = require('./color').default
// const { dataConditionFunction } = require('./dataFunction').default
// const parseCondition = require('./parseCondition').default
const { linear, exponential, quad, cubic, step } = require('./easingFunctions').default

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

// these functions prep a getter function for change of zoom for color and opacity changes
function zoomRangeFunction (input) {
  // grab function type
  const zoomType = input.shift()
  const easeFunction = getEasingFunction(zoomType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseCondition(input[c])
    c += 2
  }

  return (properties, zoom) => {
    if (zoom <= input[0]) {
      return input[1](properties, zoom)
    } else if (zoom >= input[input.length - 2]) {
      return input[input.length - 1](properties, zoom)
    } else {
      let i = 0
      while (input[i] <= zoom) i += 2
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = input[i - 2]
      const startValue = input[i - 1](properties, zoom)
      if (startZoom === zoom) return startValue
      const endZoom = input[i]
      const endValue = input[i + 1](properties, zoom)
      // now we interpolate
      return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
    }
  }
}

function getEasingFunction(zoomType) {
  const func = (zoomType === 'lin')
    ? linear
    : (zoomType === 'expo')
      ? exponential
      : (zoomType === 'quad')
        ? quad
        : (zoomType === 'cubic')
          ? cubic
          : step
  return (zoom, start, end, startValue, endValue) => {
    const t = func(zoom, start, end)
    if (isNaN(startValue)) { // we are dealing with colors
      return Color.interpolate(startValue, endValue, t)
    } else { // perhaps line-width or some other number value; Given our t depth, convert to a new value
      return startValue + t * (endValue - startValue)
    }
  }
}

function parseCondition (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = dataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = dataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-condition') {
      const parsedZoomFunction = zoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => null }
  } else {
    if (isNaN(input)) {
      const color = new Color(input) // pre-create the color
      return () => color
    } else {
      return () => input
    }
  }
}

function dataConditionFunction (input) {
  const conditions = []
  let defaultExists = false
  while (input.length) {
    if (Array.isArray(input[0])) {
      const [key, condition, value] = input.shift()
      const result = parseCondition(input.shift())
      conditions.push({
        key,
        condition: parseFilterCondition(condition, value),
        result
      })
    } else if (input[0] === 'default') {
      input.shift()
      conditions['default'] = parseCondition(input.shift())
      defaultExists = true
    }
  }
  if (!defaultExists) conditions['default'] = parseCondition(null) // just incase it's missing in the style json
  return (properties, zoom) => {
    if (properties) {
      for (const condition of conditions) { // run through the conditions
        if (properties[condition.key] && condition.condition(properties[condition.key])) {
          return condition.result(properties, zoom)
        }
      }
    }
    // if we made it here, just run default
    return conditions['default'](properties, zoom)
  }
}

function parseFilterCondition (condition, value) {
  // manage multiple conditions
  if (condition === "==") return (input) => input == value
  else if (condition === "!=") return (input) => input != value
  else if (condition === ">") return (input) => input > value
  else if (condition === ">=") return (input) => input >= value
  else if (condition === "<") return (input) => input < value
  else if (condition === "<=") return (input) => input <= value
}

exports.default = zoomRangeFunction
