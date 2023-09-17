import coalesceField from './coalesceField'

import type { Comparitor } from './style.spec'
import type { Properties } from 'geometry'

// examples:
// filter: { key: 'class', comparitor: '==', value: 'ocean' }
// TODO: FIX THESE LAST TWO EXAMPLES
// 'filter': ['or', ['class', '==', 'ocean'], ['class', '==', 'river']]
// 'filter': ['and', ['class', '==', 'ocean'], ['class', '==', 'lake'], ['class', '!=', 'river']]

export type ConditionFunction = (input: string | number, properties: Properties) => boolean

export type FilterFunction = (properties: Properties) => boolean

export interface Conditional {
  keyCondition?: {
    key: string
    keyFunction: ConditionFunction
  }
  filterCondition?: FilterFunction
}

export interface Condition {
  key: string
  comparitor: Comparitor
  value?: string | number | string[] | number[]
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
    const { key, comparitor, value } = filter
    if (typeof comparitor !== 'string') throw new Error('comparitor must be a string')
    const filterLambda = parseFilterCondition(comparitor, value)
    return (properties: Properties = {}) => {
      return filterLambda(coalesceField(key, properties, true), properties)
    }
  }
}

// NOTE: We disable the eslint rule here because we want to allow the use of
//      `==` and `!=` instead of `===` and `!==` because we want to allow
//      comparisons between strings and numbers.
function parseFilterCondition (
  comparitor: Comparitor,
  value?: string | number | string[] | number[]
): ConditionFunction {
  // manage multiple comparitors
  // eslint-disable-next-line
  if (comparitor === '==') return (input: string | number, properties: Properties) => input == buildValue(value, properties) // ['class', '==', 'ocean'] OR ['elev', '==', 50]
  // eslint-disable-next-line
  else if (comparitor === '!=') return (input: string | number, properties: Properties): boolean => input != buildValue(value, properties) // ['class', '!=', 'ocean'] OR ['elev', '!=', 50]
  else if (comparitor === '>') return (input: string | number, properties: Properties): boolean => input > buildValue(value, properties) // ['elev', '>', 50]
  else if (comparitor === '>=') return (input: string | number, properties: Properties): boolean => input >= buildValue(value, properties) // ['elev', '>=', 50]
  else if (comparitor === '<') return (input: string | number, properties: Properties): boolean => input < buildValue(value, properties) // ['elev', '<', 50]
  else if (comparitor === '<=') return (input: string | number, properties: Properties): boolean => input <= buildValue(value, properties) // ['elev', '<=', 50]
  else if (comparitor === 'has') return (input: string | number, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? (buildValue(value, properties) as string | number[]).includes(input as never) : false // ['class', 'has', ['ocean', 'river']] OR ['elev', 'in', [2, 3, 4, 5]]
  else if (comparitor === '!has') return (input: string | number, properties: Properties): boolean => Array.isArray(value) || typeof value === 'string' ? !(buildValue(value, properties) as string | number[]).includes(input as never) : true // ['class', '!has', ['ocean', 'river']] OR ['elev', '!in', [2, 3, 4, 5]]
  else return () => false
}

function buildValue (
  value?: string | number | string[] | number[],
  properties: Properties = {}
): string | number | number[] {
  if (
    typeof value === 'string' ||
    (Array.isArray(value) && typeof value[0] === 'string')
  ) return coalesceField(value as string | string[], properties)
  return value as number | number[]
}
