import parseFilter from './parseFilter'

import type {
  DataCondition,
  DataRangeEase,
  DataRangeStep,
  InputRangeEase,
  InputRangeStep,
  LayerWorkerFunction,
  NotNullOrObject,
  NumberColor,
  Property,
  ValueType
} from './style.spec'
import type { FilterFunction } from './parseFilter'
import type { Properties } from 'geometry'

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
  if (typeof input === 'object' && !Array.isArray(input)) {
    if ('dataCondition' in input && input.dataCondition !== undefined) {
      return dataConditionFunction<T, U>(input.dataCondition, cb)
    } else if ('dataRange' in input && input.dataRange !== undefined) {
      return dataRangeFunction<T, U>(input.dataRange, cb)
    } else if ('inputRange' in input && input.inputRange !== undefined) {
      return inputRangeFunction<T, U>(input.inputRange, cb)
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

function dataRangeFunction<T extends NotNullOrObject, U> (
  dataRange: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>,
  cb: Callback<T, U>
): LayerWorkerFunction<U> {
  const { key, ranges } = dataRange

  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb)
    }
  })

  return (code: number[], properties: Properties, _zoom: number): U => {
    const dataInput = (properties[key] !== undefined && !isNaN(properties[key] as number))
      ? +(properties[key] as number)
      : 0
    if (dataInput <= parsedRanges[0].stop) {
      return parsedRanges[0].input(code, properties, dataInput)
    } else if (dataInput >= parsedRanges[parsedRanges.length - 1].stop) {
      return parsedRanges[parsedRanges.length - 1].input(code, properties, dataInput)
    } else {
      let i = 0
      while (parsedRanges[i] !== undefined && parsedRanges[i].stop <= dataInput) i++
      if (parsedRanges.length === i) i--
      return parsedRanges[i - 1].input(code, properties, dataInput)
    }
  }
}

// TODO: Support type property (defaults to 'zoom')
function inputRangeFunction<T extends NotNullOrObject, U> (
  inputRange: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>,
  cb: Callback<T, U>
): LayerWorkerFunction<U> {
  const { ranges } = inputRange

  // first ensure each result property is parsed:
  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb)
    }
  })

  return (code: number[], properties: Properties, zoom: number): U => {
    if (zoom <= parsedRanges[0].stop) {
      return parsedRanges[0].input(code, properties, zoom)
    } else if (zoom >= parsedRanges[parsedRanges.length - 1].stop) {
      return parsedRanges[parsedRanges.length - 1].input(code, properties, zoom)
    } else {
      let i = 0
      while (parsedRanges[i] !== undefined && parsedRanges[i].stop <= zoom) i++
      if (parsedRanges.length === i) i--
      return parsedRanges[i - 1].input(code, properties, zoom)
    }
  }
}
