// @flow
import Color from '../color'
import { parseFilter, getEasingFunction } from './'

// This functionality is built for the draw thread
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
    } else {
      const data = [conditionType, ...input]
      return () => data
    }
  } else if (attr === 'color' || attr === 'fill' || attr === 'stroke') {
    const color = new Color(input)
    return () => color
  } else { return () => input }
}

function dataConditionFunction (input, attr) {
  const conditions = []
  let defaultExists = false
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
      conditions['default'] = parseFeatureFunction(input.shift(), attr)
      defaultExists = true
    }
  }
  if (!defaultExists) conditions['default'] = () => null // just incase it's missing in the style json
  return (properties, zoom, code) => {
    if (properties) {
      let condition
      for (let i = 0, cl = conditions.length; i < cl; i++) { // run through the conditions
        condition = conditions[i]
        if (condition.condition(properties)) {
          if (code) code.push(i + 1)
          return condition.result(properties, zoom, code)
        }
      }
    }
    // if we made it here, just run default
    if (code) code.push(0)
    return conditions['default'](properties, zoom)
  }
}

function dataRangeFunction (input, attr) {
  // grab function type
  const zoomType = input.shift()
  const key = input.shift()
  const easeFunction = getEasingFunction(zoomType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c], attr)
    c += 2
  }

  return (properties, zoom, code) => {
    const dataInput = (properties && properties[key] && !isNaN(properties[key])) ? +properties[key] : 0
    if (dataInput <= input[0]) {
      return input[1](properties, dataInput, code)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](properties, dataInput, code)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = input[i - 2]
      const startValue = input[i - 1](properties, dataInput, code)
      if (startRange === dataInput) return startValue
      const endRange = input[i]
      const endValue = input[i + 1](properties, dataInput, code)
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

  return (properties, zoom, code) => {
    if (zoom <= input[0]) {
      return input[1](properties, zoom, code)
    } else if (zoom >= input[input.length - 2]) {
      return input[input.length - 1](properties, zoom, code)
    } else {
      let i = 0
      while (input[i] <= zoom) i += 2
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = input[i - 2]
      const startValue = input[i - 1](properties, zoom, code)
      if (startZoom === zoom) return startValue
      const endZoom = input[i]
      const endValue = input[i + 1](properties, zoom, code)
      // now we interpolate
      return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
    }
  }
}
