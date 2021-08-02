// @flow
import { coalesceField } from './'
// examples:
// "filter": ["or", ["class", "==", "ocean"], ["class", "==", "river"]]
// "filter": ["and", ["class", "==", "ocean"], ["class", "==", "lake"], ["class", "!=", "river"]]
export default function parseFilter (filter: undefined | Array<string | Array<any>>) {
  if (!filter) return () => true
  // first attribute describes how if we have a bunch of && or ||
  const andOr = (filter[0] === 'or' || filter[0] === 'and') ? filter.shift() : null
  if (!andOr) {
    const [key, condition, value] = filter
    const filterLambda = parseFilterCondition(condition, value)
    return (properties: Object = {}) => {
      return filterLambda(coalesceField(key, properties, true), properties)
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
    return (properties: Object = {}) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (condition.condition(coalesceField(condition.key, properties, true), properties)) return true
        } else if (condition.condition(properties)) return true
      }
      return false
    }
  } else { // andOr === 'and'
    return (properties: Object = {}) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (!condition.condition(coalesceField(condition.key, properties, true), properties)) return false
        } else if (!condition.condition(properties)) return false
      }
      return true
    }
  }
}

const parseFilterCondition = (condition: string,
  value: string | number | Array<string | number>): Function => {
  // manage multiple conditions
  // eslint-disable-next-line
  if (condition === '==') return (input, properties) => input == buildValue(value, properties) // ["class", "==", "ocean"] OR ["elev", "==", 50]
  // eslint-disable-next-line
  else if (condition === '!=') return (input, properties) => input != buildValue(value, properties) // ["class", "!=", "ocean"] OR ["elev", "!=", 50]
  else if (condition === '>') return (input, properties) => input > buildValue(value, properties) // ["elev", ">", 50]
  else if (condition === '>=') return (input, properties) => input >= buildValue(value, properties) // ["elev", ">=", 50]
  else if (condition === '<') return (input, properties) => input < buildValue(value, properties) // ["elev", "<", 50]
  else if (condition === '<=') return (input, properties) => input <= buildValue(value, properties) // ["elev", "<=", 50]
  else if (condition === 'has') return (input, properties) => buildValue(value, properties).includes(input) // ["class", "has", ["ocean", "river"]] OR ["elev", "in", [2, 3, 4, 5]]
  else if (condition === '!has') return (input, properties) => !buildValue(value, properties).includes(input) // ["class", "!has", ["ocean", "river"]] OR ["elev", "!in", [2, 3, 4, 5]]
  else return () => false
}

const buildValue = (value: any, properties: Object = {}): any => {
  if (typeof value === 'string') return coalesceField(value, properties)
  return value
}
