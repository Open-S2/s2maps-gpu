import coalesceField from './coalesceField'

import type { Comparator, NestedKey, NotNullOrObject } from './style.spec'
import type { Properties } from 'geometry'

// examples:
// filter: { key: 'class', comparator: '==', value: 'ocean' }
// filter: { or: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'river' }] }
// filter: { and: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'lake' }, { key: 'class', comparator: '!=', value: 'river' }] }

export type InputCondition = string | number | string[] | number[]
export type ConditionFunction = (input: InputCondition, properties: Properties) => boolean

export type FilterFunction = (properties: Properties) => boolean

export interface Conditional {
  keyCondition?: {
    key: string
    keyFunction: ConditionFunction
  }
  filterCondition?: FilterFunction
}

export interface Condition extends NestedKey {
  comparator: Comparator
  value?: NotNullOrObject
}

export type Filter = { and: Filter[] } | { or: Filter[] } | Condition

export default function parseFilter (filter?: Filter): FilterFunction {
  if (filter === undefined) return () => true

  // case 1: AND
  if ('and' in filter) {
    const { and } = filter
    const filterLambdas = and.map(parseFilter)
    return (properties: Properties = {}) => {
      for (const filterLambda of filterLambdas) {
        if (!filterLambda(properties)) return false
      }
      return true
    }
  } else if ('or' in filter) { // case 2: OR
    const { or } = filter
    const filterLambdas = or.map(parseFilter)
    return (properties: Properties = {}) => {
      for (const filterLambda of filterLambdas) {
        if (filterLambda(properties)) return true
      }
      return false
    }
  } else { // case 3: Condition
    const { key, comparator, value } = filter
    const filterLambda = parseFilterCondition(comparator, value)
    return (properties: Properties = {}): boolean => {
      return filterLambda(coalesceField(key, properties, true), properties)
    }
  }
}

// NOTE: We disable the eslint rule here because we want to allow the use of
//      `==` and `!=` instead of `===` and `!==` because we want to allow
//      comparasons between strings and numbers.
function parseFilterCondition (
  comparator: Comparator,
  value?: NotNullOrObject
): ConditionFunction {
  // manage multiple comparators
  // eslint-disable-next-line
  if (comparator === '==') return (input: InputCondition, properties: Properties) => input == buildValue(value, properties) // ['class', '==', 'ocean'] OR ['elev', '==', 50]
  // eslint-disable-next-line
  else if (comparator === '!=') return (input: InputCondition, properties: Properties): boolean => input != buildValue(value, properties) // ['class', '!=', 'ocean'] OR ['elev', '!=', 50]
  else if (comparator === '>') return (input: InputCondition, properties: Properties): boolean => input > buildValue(value, properties) // ['elev', '>', 50]
  else if (comparator === '>=') return (input: InputCondition, properties: Properties): boolean => input >= buildValue(value, properties) // ['elev', '>=', 50]
  else if (comparator === '<') return (input: InputCondition, properties: Properties): boolean => input < buildValue(value, properties) // ['elev', '<', 50]
  else if (comparator === '<=') return (input: InputCondition, properties: Properties): boolean => input <= buildValue(value, properties) // ['elev', '<=', 50]
  else if (comparator === 'has') return (input: InputCondition, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? (buildValue(value, properties) as string | number[]).includes(input as never) : false // ['class', 'has', ['ocean', 'river']] OR ['elev', 'in', [2, 3, 4, 5]]
  else if (comparator === '!has') return (input: InputCondition, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? !(buildValue(value, properties) as string | number[]).includes(input as never) : true // ['class', '!has', ['ocean', 'river']] OR ['elev', '!in', [2, 3, 4, 5]]
  else if (comparator === 'in') return (input: InputCondition): boolean => Array.isArray(input) && typeof value === typeof input[0] ? input.includes(value as never) : false // ['elev', 'in', 50]
  else if (comparator === '!in') return (input: InputCondition): boolean => Array.isArray(input) && typeof value === typeof input[0] ? !input.includes(value as never) : true // ['class', '!in', 'ocean'] OR ['elev', '!in', 50]
  else return () => false
}

function buildValue (
  value?: NotNullOrObject,
  properties: Properties = {}
): NotNullOrObject {
  if (
    typeof value === 'string' ||
    (Array.isArray(value) && typeof value[0] === 'string')
  ) return coalesceField(value as string | string[], properties)
  return value as NotNullOrObject
}
