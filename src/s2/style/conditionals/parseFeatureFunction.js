// @flow
import Color from '../color'
import { parseFilter, getEasingFunction } from './'

// This functionality is built for the tile worker.
export default function parseFeatureFunction (input: any, attr: string) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      return dataConditionFunction(input, attr)
    } else if (conditionType === 'data-range') {
      return dataRangeFunction(input, attr)
    } else if (conditionType === 'input-range') {
      return inputRangeFunction(input, attr)
    } else if (conditionType === 'feature-state') {
      return featureStateFunction(input, attr)
    } else {
      const data = [conditionType, ...input]
      return () => data
    }
  } else if (attr === 'color' || attr === 'stroke' || attr === 'text-fill' || attr === 'text-stroke') {
    const color = new Color(input)
    return () => color
  } else { return () => input }
}

function dataConditionFunction (input, attr) {
  const conditions = []
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      const result = parseFeatureFunction(input.shift(), attr)
      conditions.push({
        condition: parseFilter(filter),
        result
      })
    } else if (input[0] === 'default') {
      input.shift()
      conditions.default = parseFeatureFunction(input.shift(), attr)
    }
  }
  if (!conditions.default) conditions.default = () => null // just incase it's missing in the style json
  return (code, properties, zoom) => {
    if (properties) {
      let condition
      for (let i = 0, cl = conditions.length; i < cl; i++) { // run through the conditions
        condition = conditions[i]
        if (condition.condition(properties)) {
          if (code) code.push(i + 1)
          return condition.result(code, properties, zoom)
        }
      }
    }
    // if we made it here, just run default
    if (code) code.push(0)
    return conditions.default(code, properties, zoom)
  }
}

function dataRangeFunction (input, attr) {
  // grab function type
  const key = input.shift()
  const easeType = input.shift()
  let base = 1
  if (easeType === 'expo') base = input.shift()
  const easeFunction = getEasingFunction(easeType, base)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c], attr)
    c += 2
  }

  return (code, properties, zoom) => {
    const dataInput = (properties && properties[key] && !isNaN(properties[key])) ? +properties[key] : 0
    if (dataInput <= input[0]) {
      return input[1](code, properties, dataInput)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](code, properties, dataInput)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = input[i - 2]
      const startValue = input[i - 1](code, properties, dataInput)
      if (startRange === dataInput) return startValue
      const endRange = input[i]
      const endValue = input[i + 1](code, properties, dataInput)
      // now we interpolate
      return easeFunction(dataInput, startRange, endRange, startValue, endValue)
    }
  }
}

function inputRangeFunction (input, attr) {
  // grab function type
  input.shift() // get input type - currently only zoom
  const easeType = input.shift()
  let base = 1
  if (easeType === 'expo') base = input.shift()
  const easeFunction = getEasingFunction(easeType, base)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c], attr)
    c += 2
  }

  return (code, properties, zoom) => {
    if (zoom <= input[0]) {
      return input[1](code, properties, zoom)
    } else if (zoom >= input[input.length - 2]) {
      return input[input.length - 1](code, properties, zoom)
    } else {
      let i = 0
      while (input[i] <= zoom) i += 2
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = input[i - 2]
      const startValue = input[i - 1](code, properties, zoom)
      if (startZoom === zoom) return startValue
      const endZoom = input[i]
      const endValue = input[i + 1](code, properties, zoom)
      // now we interpolate
      return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
    }
  }
}

// the CPU will never interact with featureStates
// so we just run 'default' case here, if no default return null
function featureStateFunction (input, attr) {
  // while not default, increment input
  while (input.length && input[0] !== 'default') input.shift()
  input = (input[0] === 'default') ? input[1] : null
  const result = parseFeatureFunction(input, attr)

  return (code, properties, zoom) => {
    return result(code, properties, zoom)
  }
}
