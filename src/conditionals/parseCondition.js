// @flow
const Color = require('./color').default
const parseFilter = require('./parseFilter').default

// This functionality is built for the Web Worker
function parseConditionEncode (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = encodeDataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = encodeDataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-range') {
      const parsedZoomFunction = encodeZoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => null }
  } else { return () => null } // the draw thread will naturally handle the appropraite color/number
}

// This functionality is built for the draw thread
function parseConditionDecode (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = decodeDataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = decodeDataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-range') {
      const parsedZoomFunction = decodeZoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => { return () => null } }
  } else {
    if (isNaN(input)) {
      const color = new Color(input)
      return () => color
    } else { return () => input }
  }
}

function encodeZoomRangeFunction (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  // Basically, since we don't know which zoom we will encounter,
  // we have to pre-run every case, and the decoder will also have to pre-run each one:
  const preSolutions = {}
  for (let i = 0, il = input.length; i < il; i += 2) {
    if (Array.isArray(input[i + 1])) {
      preSolutions[input[i]] = parseConditionEncode(input[i + 1])
    }
  }
  // now store all possible outcomes that require inputs
  return (properties, encoding) => {
    for (let key in preSolutions) {
      preSolutions[key](properties, encoding)
    }
  }
}

function decodeZoomRangeFunction (input) {
  // grab function type
  const easeType = input.shift()
  const base = (easeType === 'expo') ? input.shift() : null
  const easeFunction = getEasingFunction(easeType, base)

  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionDecode(input[c])
    c += 2
  }

  // first ensure each result property is parsed:
  return (encodings) => {
    let c = 1
    let il = input.length
    while (c < il) {
      input[c] = input[c](encodings)
      c += 2
    }

    return (zoom) => {
      if (zoom <= input[0]) {
        return input[1]
      } else if (zoom >= input[input.length - 2]) {
        return input[input.length - 1]
      } else {
        let i = 0
        while (input[i] <= zoom) i += 2
        // now we know the zoom is inbetween input[i - 2][0] and input[i - 1][0]
        const startZoom = input[i - 2]
        const startValue = input[i - 1]
        if (startZoom === zoom) return startValue
        const endZoom = input[i]
        const endValue = input[i + 1]
        // now we interpolate
        return easeFunction(zoom, startZoom, endZoom, startValue, endValue)
      }
    }
  }
}

function encodeDataConditionFunction (input) {
  const conditions = []
  let encodeResultID = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      conditions.push({
        key: filter[0],
        encodeID: encodeResultID,
        condition: parseFilter(filter),
        result: parseConditionEncode(input.shift())
      })
      encodeResultID++
    } else if (input[0] === 'default') {
      input.shift() // 'default'
      conditions['default'] = parseConditionEncode(input.shift())
    }
  }
  if (!conditions['default']) conditions['default'] = () => null // just incase it's missing in the style json
  return (properties, encoding) => {
    if (properties) {
      for (const condition of conditions) { // run through the conditions
        if (condition.condition(properties)) {
          encoding.push(condition.encodeID)
          return condition.result(properties, encoding)
        }
      }
    }
    // if we made it here, just run default
    encoding.push(0)
    return conditions['default'](properties)
  }
}

function decodeDataConditionFunction (input) {
  const conditions = {}
  let i = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      input.shift() // the filter
      conditions[i] = parseConditionDecode(input.shift())
      i++
    } else if (input[0] === 'default') {
      input.shift() // default
      conditions[0] = parseConditionDecode(input.shift())
    }
  }
  if (!conditions[0]) conditions[0] = () => null // just incase it's missing in the style json
  return (encodings) => {
    const code = encodings.shift()
    return conditions[code](encodings)
  }
}

function encodeDataRangeFunction (input) {
  // grab function type
  const easeType = input.shift() // remove ease type
  if (easeType === 'expo') input.shift() // remove base value
  const key = input.shift() // key

  // first parse all possible conditionals
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionEncode(input[c])
    c += 2
  }

  return (properties, encoding) => {
    const dataInput = (properties && properties[key] && !isNaN(properties[key])) ? +properties[key] : 0
    // first store the actual value
    encoding.push(dataInput)
    // run the functions just incase they have more encodings to share
    if (dataInput <= input[0]) {
      return input[1](properties, encoding)
    } else if (dataInput >= input[input.length - 2]) {
      return input[input.length - 1](properties, encoding)
    } else {
      let i = 0
      while (input[i] <= dataInput) i += 2
      // now we know the dataInput is inbetween input[i - 2][0] and input[i - 1][0]
      const startRange = input[i - 2]
      const startValue = input[i - 1](properties, encoding)
      // if equal to start, then we don't need to store the next encoding, we never reach it
      if (startRange === dataInput) return
      input[i + 1](properties, encoding)
      return
    }
  }
}

function decodeDataRangeFunction (input) {
  // grab function type
  const easeType = input.shift()
  const base = (easeType === 'expo') ? input.shift() : null
  const key = input.shift() // key

  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseConditionDecode(input[c])
    c += 2
  }

  // first ensure each result property is parsed:
  return (encodings) => {
    const code = encodings.shift()

    if (code <= input[0]) {
      return input[1](encodings)
    } else if (code >= input[input.length - 2]) {
      return input[input.length - 1](encodings)
    } else {
      const easeFunction = getEasingFunction(easeType, base)
      let i = 0
      while (input[i] <= code) i += 2
      // now we know the code is inbetween input[i - 2][0] and input[i - 1][0]
      const start = input[i - 2]
      const startValue = input[i - 1](encodings)
      if (start === code) return startValue
      const end = input[i]
      const endValue = input[i + 1](encodings)
      // now we interpolate
      return easeFunction(code, start, end, startValue, endValue)
    }
  }
}

function getEasingFunction(zoomType, base = 1) {
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
    const t = func(zoom, start, end, base)
    if (isNaN(startValue)) { // we are dealing with colors
      return Color.interpolate(startValue, endValue, t)
    } else { // perhaps line-width or some other number value; Given our t depth, convert to a new value
      return startValue + t * (endValue - startValue)
    }
  }
}

// y = mx
function linear (input, start, end) {
  return (input - start) / (end - start)
}

// y = e^x OR y = Math.pow(2, 10 * x)
function exponential (input, start, end, base) {
  // grab change
  const diff = end - start
  if (diff === 0) return 0
  // refine base value
  if (base <= 0) base = 0.1
  else if (base > 2) base = 2
  // grab diff
  const progress = input - start
  // linear case
  if (base === 1) return progress / diff
  // solve
  return (Math.pow(base, progress) - 1) / (Math.pow(base, diff) - 1)
}

// y = x^2
function quad (input, start, end) {
  return Math.pow(input - start, 2) / Math.pow(end - start, 2)
}

// y = x^3
function cubic (input, start, end) {
  return Math.pow(input - start, 3) / Math.pow(end - start, 3)
}

function step (input, start, end) {
  return 0 // will default to start
}

exports.default = {
  parseConditionEncode,
  parseConditionDecode
}
