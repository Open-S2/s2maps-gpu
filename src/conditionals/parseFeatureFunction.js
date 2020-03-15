// @flow
const Color = require('./color').default
// examples:
// "filter": ["or", ["class", "==", "ocean"], ["class", "==", "river"]]
// "filter": ["and", ["class", "==", "ocean"], ["class", "==", "lake"], ["class", "!=", "river"]]
function parseFilter (filter) {
  if (!filter) return () => true
  // first attribute describes how if we have a bunch of && or ||
  const andOr = (filter[0] === 'or' || filter[0] === 'and') ? filter.shift() : null
  if (!andOr) {
    const [key, condition, value] = filter
    const filterLambda = parseFilterCondition(condition, value)
    return (properties) => {
      if (properties && properties[key] != null) return filterLambda(properties[key])
    }
  }
  // first create all conditionals
  const conditionals = []
  for (const input of filter) {
    const [key, condition, value] = input
    if (key === 'or' || key === 'and') {
      conditionals.push({ condition: parseFilter(input) })
    } else {
      conditionals.push({
        key,
        condition: parseFilterCondition(condition, value)
      })
    }
  }
  // if or, join all conditionals into an array, if "or" as soon as we see a true, return true
  // if "and" than ensure all cases return true
  if (andOr === 'or') {
    return (properties) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (properties[condition.key] != null && condition.condition(properties[condition.key])) return true
        } else if (condition.condition(properties)) return true
      }
      return false
    }
  } else { // andOr === 'and'
    return (properties) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (properties[condition.key] == null || !condition.condition(properties[condition.key])) return false
        } else if (!condition.condition(properties)) return false
      }
      return true
    }
  }
}

function parseFilterCondition (condition, value) {
  // manage multiple conditions
  if (condition === "==") return (input) => input === value // ["class", "==", "ocean"] OR ["elev", "==", 50]
  else if (condition === "!=") return (input) => input !== value // ["class", "!=", "ocean"] OR ["elev", "!=", 50]
  else if (condition === ">") return (input) => input > value // ["elev", ">", 50]
  else if (condition === ">=") return (input) => input >= value // ["elev", ">=", 50]
  else if (condition === "<") return (input) => input < value // ["elev", "<", 50]
  else if (condition === "<=") return (input) => input <= value // ["elev", "<=", 50]
  else if (condition === "has") return (input) => value.includes(input) // ["class", "has", ["ocean", "river"]] OR ["elev", "in", [2, 3, 4, 5]]
  else if (condition === "!has") return (input) => !value.includes(input) // ["class", "!has", ["ocean", "river"]] OR ["elev", "!in", [2, 3, 4, 5]]
  else return () => false
}













function parseFeatureFunction (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      return dataConditionFunction(input)
    } else if (conditionType === 'data-range') {
      return dataRangeFunction(input)
    } else if (conditionType === 'input-range') {
      return inputRangeFunction(input)
    } else { return () => [conditionType, ...input] }
  } else { return () => input }
}

function dataConditionFunction (input) {
  const conditions = []
  let defaultExists = false
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      const result = parseFeatureFunction(input.shift())
      conditions.push({
        condition: parseFilter(filter),
        result
      })
    } else if (input[0] === 'default') {
      input.shift()
      conditions['default'] = parseFeatureFunction(input.shift())
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

function dataRangeFunction (input) {
  // grab function type
  const zoomType = input.shift()
  const key = input.shift()
  const easeFunction = getEasingFunction(zoomType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c])
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

function inputRangeFunction (input) {
  // grab function type
  input.shift() // get input type - currently only zoom
  const easeType = input.shift()
  const easeFunction = getEasingFunction(easeType)

  // first ensure each result property is parsed:
  let c = 1
  let il = input.length
  while (c < il) {
    input[c] = parseFeatureFunction(input[c])
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















// these modules return a value between 0->1 via a start, end, and input
// obviously, the input must be between start and end inclusive: [start, end]

function getEasingFunction (easeType, base = 1) {
  const func = (easeType === 'lin')
    ? linear
    : (easeType === 'expo')
      ? exponential
      : (easeType === 'quad')
        ? quad
        : (easeType === 'cubic')
          ? cubic
          : step
  return (zoom, start, end, startValue, endValue) => {
    const t = func(zoom, start, end, base)
    if (isNaN(startValue)) { // we are dealing with colors
      if (startValue instanceof Color) return Color.interpolate(startValue, endValue, t)
      else return startValue // if for instance a string, just ignore the easing (same as a step function)
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
function exponential (input, start, end, base = 1.5) {
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

exports.parseFeatureFunction = parseFeatureFunction
exports.parseFilter = parseFilter
