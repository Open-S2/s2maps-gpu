import parseFilter from 's2/style/parseFilter'
import getEasingFunction from 's2/style/easingFunctions'

import type { LayerWorkerFunction } from 's2/style/style.spec'
import type { FilterFunction } from 's2/style/parseFilter'
import type { Properties } from 's2/geometry'

interface DataCondition<U> {
  condition: FilterFunction
  result: LayerWorkerFunction<U>
}

export type Callback<U> = (i: any) => U

// This functionality is built for the tile worker.
export default function parseFeatureFunction<U> (
  input: string | number | any[],
  cb: Callback<U> = (i: any) => i
): LayerWorkerFunction<U> {
  if (input === undefined) {
    return () => cb(undefined)
  } else if (Array.isArray(input)) { // we hit a conditional
    input = JSON.parse(JSON.stringify(input)) as any[]
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      return dataConditionFunction<U>(input, cb)
    } else if (conditionType === 'data-range') {
      return dataRangeFunction<U>(input, cb)
    } else if (conditionType === 'input-range') {
      return inputRangeFunction<U>(input, cb)
    } else {
      const data = [conditionType, ...input]
      return () => cb(data)
    }
  } else { return () => cb(input) }
}

function dataConditionFunction<U> (input: any[], cb: Callback<U>): LayerWorkerFunction<U> {
  const conditions: Array<DataCondition<U>> = []
  let defaultCondition: LayerWorkerFunction<U> = () => cb(undefined)
  while (input.length > 0) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      const result = parseFeatureFunction(input.shift(), cb)
      conditions.push({
        condition: parseFilter(filter),
        result
      })
    } else if (input[0] === 'default') {
      input.shift()
      defaultCondition = parseFeatureFunction(input.shift(), cb)
    }
  }
  return (code: number[], properties: Properties, zoom = 0): U => {
    if (properties !== undefined) {
      let condition
      for (let i = 0, cl = conditions.length; i < cl; i++) { // run through the conditions
        condition = conditions[i]
        if (condition.condition(properties)) {
          code.push(i + 1)
          return condition.result(code, properties, zoom)
        }
      }
    }
    // if we made it here, just run default
    code.push(0)
    return defaultCondition?.(code, properties, zoom) ?? cb(undefined)
  }
}

function dataRangeFunction<U> (input: any[], cb: Callback<U>): LayerWorkerFunction<U> {
  // grab function type
  const key: string = input.shift()
  const easeType = input.shift()
  let base = 1
  if (easeType === 'expo') base = input.shift()
  const easeFunction = getEasingFunction(easeType, base)

  // first ensure each result property is parsed:
  let c = 1
  const il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c], cb)
    c += 2
  }

  return (code: number[], properties: Properties, _zoom: number): U => {
    const dataInput = (properties[key] !== undefined && !isNaN(properties[key] as number)) ? +(properties[key] as any) : 0
    if (dataInput <= input[0]) {
      return input[1](code, properties, dataInput)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](code, properties, dataInput)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange: number = input[i - 2]
      const startValue: number = input[i - 1](code, properties, dataInput)
      if (startRange === dataInput) return cb(startValue)
      const endRange: number = input[i]
      const endValue = input[i + 1](code, properties, dataInput)
      // now we interpolate
      return cb(easeFunction(dataInput, startRange, endRange, startValue, endValue))
    }
  }
}

function inputRangeFunction<U> (input: any[], cb: Callback<U>): LayerWorkerFunction<U> {
  // grab function type
  input.shift() // get input type - currently only zoom
  const easeType = input.shift()
  let base = 1
  if (easeType === 'expo') base = input.shift()
  const easeFunction = getEasingFunction(easeType, base)

  // first ensure each result property is parsed:
  let c = 1
  const il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c], cb)
    c += 2
  }

  return (code: number[], properties: Properties, zoom: number): U => {
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
      return cb(easeFunction(zoom, startZoom, endZoom, startValue, endValue))
    }
  }
}
