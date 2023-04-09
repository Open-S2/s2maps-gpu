import coalesceField from './coalesceField'

import type { Properties } from 's2/projections'

// examples:
// filter: ["class", "==", "ocean"]
// "filter": ["or", ["class", "==", "ocean"], ["class", "==", "river"]]
// "filter": ["and", ["class", "==", "ocean"], ["class", "==", "lake"], ["class", "!=", "river"]]

export type ConditionFunction = (input: string | number, properties: Properties) => boolean

export type FilterFunction = (properties: Properties) => boolean

export interface Conditional {
  keyCondition?: {
    key: string
    keyFunction: ConditionFunction
  }
  filterCondition?: FilterFunction
}

export default function parseFilter (filter?: string | any[] | Array<string | any[]>): FilterFunction {
  if (filter === undefined) return () => true
  // first attribute describes how if we have a bunch of && or ||
  const andOr = (Array.isArray(filter) && (filter[0] === 'or' || filter[0] === 'and')) ? filter.shift() : undefined
  if (andOr === undefined) {
    const [key, condition, value] = filter
    if (typeof condition !== 'string') throw new Error('condition must be a string')
    const filterLambda = parseFilterCondition(condition, value)
    return (properties: Properties = {}) => {
      return filterLambda(coalesceField(key, properties, true), properties)
    }
  }
  // first create all conditionals
  const conditionals: Conditional[] = []
  for (const input of filter) {
    const [key, condition, value] = input
    if (key === 'or' || key === 'and') {
      conditionals.push({ filterCondition: parseFilter(input) })
    } else {
      conditionals.push({
        keyCondition: {
          key,
          keyFunction: parseFilterCondition(condition, value)
        }
      })
    }
  }
  // if or, join all conditionals into an array, if "or" as soon as we see a true, return true
  // if "and" than ensure all cases return true
  if (andOr === 'or') {
    return (properties: Properties) => {
      for (const condition of conditionals) {
        if (condition.keyCondition !== undefined) {
          const { key, keyFunction } = condition.keyCondition
          const coalescedField = coalesceField(key, properties, true)
          if (keyFunction(coalescedField, properties)) return true
        } else if (condition.filterCondition?.(properties) ?? false) return true
      }
      return false
    }
  } else { // andOr === 'and'
    return (properties: Properties = {}) => {
      for (const condition of conditionals) {
        if (condition.keyCondition !== undefined) {
          const { key, keyFunction } = condition.keyCondition
          const coalescedField = coalesceField(key, properties, true)
          if (!keyFunction(coalescedField, properties)) return false
        } else if (!(condition.filterCondition?.(properties) ?? false)) return false
      }
      return true
    }
  }
}

function parseFilterCondition (
  condition: string,
  value: string | number | string[] | number[]
): ConditionFunction {
  // manage multiple conditions
  // eslint-disable-next-line
  if (condition === '==') return (input: string | number, properties: Properties) => input == buildValue(value, properties) // ["class", "==", "ocean"] OR ["elev", "==", 50]
  // eslint-disable-next-line
  else if (condition === '!=') return (input: string | number, properties: Properties): boolean => input != buildValue(value, properties) // ["class", "!=", "ocean"] OR ["elev", "!=", 50]
  else if (condition === '>') return (input: string | number, properties: Properties): boolean => input > buildValue(value, properties) // ["elev", ">", 50]
  else if (condition === '>=') return (input: string | number, properties: Properties): boolean => input >= buildValue(value, properties) // ["elev", ">=", 50]
  else if (condition === '<') return (input: string | number, properties: Properties): boolean => input < buildValue(value, properties) // ["elev", "<", 50]
  else if (condition === '<=') return (input: string | number, properties: Properties): boolean => input <= buildValue(value, properties) // ["elev", "<=", 50]
  else if (condition === 'has') return (input: string | number, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? (buildValue(value, properties) as string | number[]).includes(input as never) : false // ["class", "has", ["ocean", "river"]] OR ["elev", "in", [2, 3, 4, 5]]
  else if (condition === '!has') return (input: string | number, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? !(buildValue(value, properties) as string | number[]).includes(input as never) : true // ["class", "!has", ["ocean", "river"]] OR ["elev", "!in", [2, 3, 4, 5]]
  else return () => false
}

function buildValue (
  value: string | number | string[] | number[],
  properties: Properties = {}
): string | number | number[] {
  // if (
  //   typeof value === 'string' ||
  //   (Array.isArray(value) && typeof value[0] === 'string')
  // ) return coalesceField(value as string | string[], properties)
  if (
    typeof value === 'string'
  ) return coalesceField(value, properties)
  return value as number | number[]
}
