import parseFilter from './parseFilter'
import getEasingFunction from './easingFunctions'

import type {
  DataCondition,
  DataRange,
  InputRange,
  LayerWorkerFunction,
  NotNullOrObject,
  NumberColor,
  Property,
  ValueType
} from './style.spec'
import type { FilterFunction } from './parseFilter'
import type { Properties } from 'geometry'
import type Color from './color'

interface DataConditionList<U> {
  condition: FilterFunction
  result: LayerWorkerFunction<U>
}

export type Callback<T extends NotNullOrObject, U> = (i: T) => U

// This functionality is built for the tile worker.
export default function parseFeatureFunction<T extends NotNullOrObject, U = T> (
  input: ValueType<T> | Property<ValueType<T>>,
  cb: Callback<T, U> = (i: T): U => i as unknown as U
): LayerWorkerFunction<U> {
  if (typeof input === 'object') {
    if ('dataCondition' in input && input.dataCondition !== undefined) {
      return dataConditionFunction<T, U>(input.dataCondition, cb)
    } else if ('dataRange' in input && input.dataRange !== undefined) {
      return dataRangeFunction<T>(input.dataRange, cb as Callback<T, NumberColor<U>>) as LayerWorkerFunction<U>
    } else if ('inputRange' in input && input.inputRange !== undefined) {
      return inputRangeFunction<T>(input.inputRange, cb as Callback<T, NumberColor<U>>) as LayerWorkerFunction<U>
    } else if ('fallback' in input && input.fallback !== undefined) {
      return parseFeatureFunction(input.fallback, cb)
    } else { throw Error('invalid input') }
  } else { return () => cb(input) }
}

function dataConditionFunction<T extends NotNullOrObject, U> (
  dataCondition: DataCondition<ValueType<T>>,
  cb: Callback<ValueType<T>, U>
): LayerWorkerFunction<U> {
  const { conditions, fallback } = dataCondition
  const conditionList: Array<DataConditionList<U>> = []
  const fallbackCondition = parseFeatureFunction(fallback)
  // store conditions
  for (const condition of conditions) {
    conditionList.push({
      condition: parseFilter(condition.filter),
      result: parseFeatureFunction(condition.input, cb)
    })
  }
  // build function
  return (code: number[], properties: Properties, zoom = 0): U => {
    if (properties !== undefined) {
      let condition
      for (let i = 0, cl = conditionList.length; i < cl; i++) { // run through the conditionList
        condition = conditionList[i]
        if (condition.condition(properties)) {
          code.push(i + 1)
          return condition.result(code, properties, zoom)
        }
      }
    }
    // if we made it here, just run the fallback
    code.push(0)
    const fallback = fallbackCondition?.(code, properties, zoom) as ValueType<T>
    return cb(fallback)
  }
}

function dataRangeFunction<T extends NotNullOrObject> (
  dataRange: DataRange<NumberColor<T>>,
  cb: Callback<T, number | Color>
): LayerWorkerFunction<number | Color> {
  const { key, ease, base, ranges } = dataRange
  const easeFunction = getEasingFunction(ease ?? 'lin', base)

  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb)
    }
  })

  return (code: number[], properties: Properties, _zoom: number): number | Color => {
    const dataInput = (properties[key] !== undefined && !isNaN(properties[key] as number))
      ? +(properties[key] as number)
      : 0
    if (dataInput <= parsedRanges[0].stop) {
      return parsedRanges[0].input(code, properties, dataInput)
    } else if (dataInput >= parsedRanges[parsedRanges.length - 1].stop) {
      return parsedRanges[parsedRanges.length - 1].input(code, properties, dataInput)
    } else {
      let i = 0
      while (parsedRanges[i].stop <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = parsedRanges[i - 1].stop
      const startValue = parsedRanges[i - 1].input(code, properties, dataInput)
      if (startRange === dataInput) return startValue
      const endRange = parsedRanges[i].stop
      const endValue = parsedRanges[i].input(code, properties, dataInput)
      // now we interpolate
      return easeFunction(dataInput, startRange, endRange, startValue, endValue)
    }
  }
}

// TODO: Support type property (defaults to 'zoom')
function inputRangeFunction<T extends NotNullOrObject> (
  inputRange: InputRange<NumberColor<T>>,
  cb: Callback<T, number | Color>
): LayerWorkerFunction<number | Color> {
  const { ease, base, ranges } = inputRange
  const easeFunction = getEasingFunction(ease ?? 'lin', base)

  // first ensure each result property is parsed:
  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb)
    }
  })

  return (code: number[], properties: Properties, zoom: number): number | Color => {
    if (zoom <= parsedRanges[0].stop) {
      return parsedRanges[0].input(code, properties, zoom)
    } else if (zoom >= parsedRanges[parsedRanges.length - 1].stop) {
      return parsedRanges[parsedRanges.length - 1].input(code, properties, zoom)
    } else {
      let i = 0
      while (parsedRanges[i].stop <= zoom) i += 2
      // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
      const startZoom = parsedRanges[i - 2].stop
      const startValue = parsedRanges[i - 1].input(code, properties, zoom)
      if (startZoom === zoom) return startValue
      const endZoom = parsedRanges[i].stop
      const endValue = parsedRanges[i + 1].input(code, properties, zoom)
      // now we interpolate
      return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
    }
  }
}
