import getEasingFunction from './easingFunctions.js';
import parseFilter from './parseFilter.js';

import type { FilterFunction } from './parseFilter.js';
import type { Properties } from 'gis-tools/index.js';
import type {
  DataCondition,
  DataRangeEase,
  DataRangeStep,
  InputRangeEase,
  InputRangeStep,
  InputValue,
  LayerWorkerFunction,
  NestedKey,
  NotNullOrObject,
  NumberColor,
  Property,
  ValueType,
} from './style.spec.js';

/** Data Condition wrapper */
interface DataConditionList<U> {
  condition: FilterFunction;
  result: LayerWorkerFunction<U>;
}
/** Callback for various conditions */
export type Callback<T extends NotNullOrObject, U> = (i: T) => U;

/**
 * This functionality is built for the tile worker. It helps with building data the GPU can parse
 * to manipulate input values into output values on the GPU.
 * @param input - input value or property
 * @param cb - callback function
 * @returns a generic layer worker function
 */
export default function parseFeatureFunction<T extends NotNullOrObject, U = T>(
  input: ValueType<T> | Property<ValueType<T>>,
  cb: Callback<T, U> = (i: T): U => i as unknown as U,
): LayerWorkerFunction<U> {
  if (typeof input === 'object' && !Array.isArray(input)) {
    if ('inputValue' in input && input.inputValue !== undefined) {
      return inputValueFunction(input.inputValue, cb);
    } else if ('dataCondition' in input && input.dataCondition !== undefined) {
      return dataConditionFunction<T, U>(input.dataCondition, cb);
    } else if ('dataRange' in input && input.dataRange !== undefined) {
      return dataRangeFunction<T, U>(input.dataRange, cb);
    } else if ('inputRange' in input && input.inputRange !== undefined) {
      return inputRangeFunction<T, U>(input.inputRange, cb);
    } else if ('fallback' in input && input.fallback !== undefined) {
      return parseFeatureFunction(input.fallback, cb);
    } else {
      throw Error('invalid input');
    }
  } else {
    return () => cb(input);
  }
}

/**
 * Input value function parser
 * @param inputValue - input value
 * @param cb - callback function
 * @returns a generic layer worker function designed for input values
 */
function inputValueFunction<T extends NotNullOrObject, U>(
  inputValue: InputValue<ValueType<T>>,
  cb: Callback<ValueType<T>, U>,
): LayerWorkerFunction<U> {
  return (code: number[], properties: Properties): U => {
    let endKey: string | NestedKey = inputValue.key;
    // dive into nested properties if needed
    while (typeof endKey === 'object' && 'key' in endKey) {
      properties = (properties[endKey.nestedKey ?? ''] ?? {}) as Properties;
      endKey = endKey.key;
    }
    // return the input if it exists, otherwise fallback
    const res = (properties[endKey] ?? inputValue.fallback) as ValueType<T>;
    const cbValue = cb(res);
    if (typeof cbValue === 'number') code.push(1, cbValue);
    else if (Array.isArray(cbValue)) code.push(cbValue.length, ...cbValue);
    return cbValue;
  };
}

/**
 * Data condition function parser
 * @param dataCondition - data condition input
 * @param cb - callback function
 * @returns a generic layer worker function designed for data conditions
 */
function dataConditionFunction<T extends NotNullOrObject, U>(
  dataCondition: DataCondition<ValueType<T>>,
  cb: Callback<ValueType<T>, U>,
): LayerWorkerFunction<U> {
  const { conditions, fallback } = dataCondition;
  const conditionList: Array<DataConditionList<U>> = [];
  const fallbackCondition = parseFeatureFunction(fallback);
  // store conditions
  for (const condition of conditions) {
    conditionList.push({
      condition: parseFilter(condition.filter),
      result: parseFeatureFunction(condition.input, cb),
    });
  }
  // build function
  return (code: number[], properties: Properties, zoom = 0): U => {
    if (properties !== undefined) {
      for (let i = 0, cl = conditionList.length; i < cl; i++) {
        // run through the conditionList
        const { condition, result } = conditionList[i];
        if (condition(properties) === true) {
          code.push(i + 1);
          return result(code, properties, zoom);
        }
      }
    }
    // if we made it here, just run the fallback
    code.push(0);
    const fallback = fallbackCondition?.(code, properties, zoom) as ValueType<T>;
    return cb(fallback);
  };
}

/**
 * Data range function parser
 * @param dataRange - data range
 * @param cb - callback function
 * @returns a generic layer worker function for data ranges
 */
function dataRangeFunction<T extends NotNullOrObject, U>(
  dataRange: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>,
  cb: Callback<T, U>,
): LayerWorkerFunction<U> {
  const { key, ranges, ease, base } = dataRange;
  const easeFunction = getEasingFunction<U>(ease, base);

  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb),
    };
  });

  return (code: number[], properties: Properties, _zoom: number): U => {
    let endKey: string | NestedKey = key;
    // dive into nested properties if needed
    while (typeof endKey === 'object' && 'key' in endKey) {
      properties = (properties[endKey.nestedKey ?? ''] ?? {}) as Properties;
      endKey = endKey.key;
    }
    const dataInput =
      properties[endKey] !== undefined && !isNaN(properties[endKey] as number)
        ? Number(properties[endKey])
        : 0;
    if (dataInput <= parsedRanges[0].stop) {
      // less then or equal to first stop
      return parsedRanges[0].input(code, properties, dataInput);
    } else if (dataInput >= parsedRanges[parsedRanges.length - 1].stop) {
      // greater then or equal to last stop
      return parsedRanges[parsedRanges.length - 1].input(code, properties, dataInput);
    } else {
      // somewhere inbetween two stops. lets interpolate
      let i = 0;
      while (parsedRanges[i] !== undefined && parsedRanges[i].stop <= dataInput) i++;
      if (parsedRanges.length === i) i--;
      const startValue = parsedRanges[i - 1].input(code, properties, dataInput);
      const startStop: number = parsedRanges[i - 1].stop;
      const endValue = parsedRanges[i].input(code, properties, dataInput);
      const endStop: number = parsedRanges[i].stop;
      return easeFunction(dataInput, startStop, endStop, startValue, endValue);
    }
  };
}

// TODO: Support type property (defaults to 'zoom')
/**
 * Input range function parser
 * @param inputRange - input range
 * @param cb - callback function
 * @returns a generic layer worker function for input ranges
 */
function inputRangeFunction<T extends NotNullOrObject, U>(
  inputRange: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>,
  cb: Callback<T, U>,
): LayerWorkerFunction<U> {
  const { ranges, ease, base } = inputRange;
  const easeFunction = getEasingFunction<U>(ease, base);

  // first ensure each result property is parsed:
  const parsedRanges = ranges.map(({ stop, input }) => {
    return {
      stop,
      input: parseFeatureFunction(input, cb),
    };
  });

  return (code: number[], properties: Properties, zoom: number): U => {
    if (zoom <= parsedRanges[0].stop) {
      return parsedRanges[0].input(code, properties, zoom);
    } else if (zoom >= parsedRanges[parsedRanges.length - 1].stop) {
      return parsedRanges[parsedRanges.length - 1].input(code, properties, zoom);
    } else {
      let i = 0;
      while (parsedRanges[i] !== undefined && parsedRanges[i].stop <= zoom) i++;
      if (parsedRanges.length === i) i--;
      const startValue = parsedRanges[i - 1].input(code, properties, zoom);
      const startStop: number = parsedRanges[i - 1].stop;
      const endValue = parsedRanges[i].input(code, properties, zoom);
      const endStop: number = parsedRanges[i].stop;
      return easeFunction(zoom, startStop, endStop, startValue, endValue);
    }
  };
}
