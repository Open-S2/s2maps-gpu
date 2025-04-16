import coalesceField from './coalesceField.js';

import type { Properties } from 'gis-tools/index.js';
import type { Comparator, NestedKey, NotNullOrObject } from './style.spec.js';

// examples:
// filter: { key: 'class', comparator: '==', value: 'ocean' }
// filter: { or: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'river' }] }
// filter: { and: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'lake' }, { key: 'class', comparator: '!=', value: 'river' }] }

/** Input condition could be a string, number, string[], or number[] */
export type InputCondition = string | number | string[] | number[];
/** Conditional function build for filtering */
export type ConditionFunction = (input: InputCondition, properties: Properties) => boolean;
/** Filter function */
export type FilterFunction = (properties: Properties) => boolean;
/** Conditional manager */
export interface Conditional {
  keyCondition?: {
    key: string;
    keyFunction: ConditionFunction;
  };
  filterCondition?: FilterFunction;
}

/**
 * Condition object.
 *
 * Also @see {@link Filter}
 *
 * When creating conditionals, you have two ways to do it:
 *
 * ## 1. keyCondition
 *
 * ```json
 * { "filter": { "key": "type", "comparator": "in", "value": ["ocean", "lake"] } }
 *
 * ## 2. filterCondition
 *
 * ```json
 * { "filter": { "and": [{ "key": "class", "comparator": "==", "value": "ocean" }, { "key": "size", "comparator": "==", "value": "large" }, { "key": "type", "comparator": "!=", "value": "pacific" }] } }
 * ```
 *
 * ## Nesting
 *
 * Sometimes vector data's properties are complex objects. To access nested fields, you can use dot notation.
 *
 * ```json
 * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
 * ```
 */
export interface Condition extends NestedKey {
  /**
   * One of `"==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "!in" | "has" | "!has"`
   * Used by the filter function to determine if a feature should be included in the render.
   *
   * NOTE: "in" means "in the array" and "has" means "has the key"
   *
   * ex.
   * ```json
   * { "filter": { "key": "type", "comparator": "in", "value": ["ocean", "lake"] } }
   * ```
   * this would be used to filter features where `feature.properties.type` is either "ocean" or "lake"
   *
   * ex.
   * ```json
   * { "filter": { "key": "type", "comparator": "has", "value": "ocean" } }
   * ```
   * this would be used to filter features where `feature.properties.type` is an array that has the key "ocean"
   */
  comparator: Comparator;
  /**
   * A non null object.
   *
   * Must be an array for "in" or "!in"
   */
  value?: NotNullOrObject;
}

/**
 * Filter Definition
 *
 * example:
 *
 * ```json
 * "filter": { "key": "class", "comparator": "==", "value": "ocean" }
 * ```
 *
 * another example:
 *
 * ```json
 * "filter": {
 *  "or": [
 *    { "key": "class", "comparator": "==", "value": "ocean" },
 *    { "key": "class", "comparator": "==", "value": "bay" }
 *  ]
 * }
 * ```
 *
 * another example:
 *
 * ```json
 * "filter": {
 *  "and": [
 *    { "key": "class", "comparator": "==", "value": "ocean" },
 *    { "key": "size", "comparator": "==", "value": "large" },
 *    { "key": "type", "comparator": "!=", "value": "pacific" }
 *  ]
 * }
 * ```
 */
export type Filter = AndFilter | OrFilter | Condition;
/** And Gate Filter */
export interface AndFilter {
  and: Filter[];
}
/** Or Gate Filter */
export interface OrFilter {
  or: Filter[];
}

/**
 * Parse a filter into a filter function
 * @param filter - input user defined filter
 * @returns a filter function that represents the user defined filter
 */
export default function parseFilter(filter?: Filter): FilterFunction {
  if (filter === undefined) return () => true;

  // case 1: AND
  if ('and' in filter) {
    const { and } = filter;
    const filterLambdas = and.map(parseFilter);
    return (properties: Properties = {}) => {
      for (const filterLambda of filterLambdas) {
        if (!filterLambda(properties)) return false;
      }
      return true;
    };
  } else if ('or' in filter) {
    // case 2: OR
    const { or } = filter;
    const filterLambdas = or.map(parseFilter);
    return (properties: Properties = {}) => {
      for (const filterLambda of filterLambdas) {
        if (filterLambda(properties)) return true;
      }
      return false;
    };
  } else {
    // case 3: Condition
    const { key, comparator, value } = filter;
    const filterLambda = parseFilterCondition(comparator, value);
    return (properties: Properties = {}): boolean => {
      return filterLambda(coalesceField(key, properties, true), properties);
    };
  }
}

/**
 * Parse a filter condition
 * Note: We disable the eslint rule here because we want to allow the use of
 *      `==` and `!=` instead of `===` and `!==` because we want to allow
 *      comparasons between strings and numbers.
 * @param comparator - comparator operator
 * @param value - input value
 * @returns Condition function result
 */
function parseFilterCondition(comparator: Comparator, value?: NotNullOrObject): ConditionFunction {
  // manage multiple comparators
  if (comparator === '==')
    return (input: InputCondition, properties: Properties) =>
      // eslint-disable-next-line eqeqeq
      input == buildValue(value, properties);
  // ['class', '==', 'ocean'] OR ['elev', '==', 50]
  else if (comparator === '!=')
    return (input: InputCondition, properties: Properties): boolean =>
      // eslint-disable-next-line eqeqeq
      input != buildValue(value, properties);
  // ['class', '!=', 'ocean'] OR ['elev', '!=', 50]
  else if (comparator === '>')
    return (input: InputCondition, properties: Properties): boolean =>
      input > buildValue(value, properties);
  // ['elev', '>', 50]
  else if (comparator === '>=')
    return (input: InputCondition, properties: Properties): boolean =>
      input >= buildValue(value, properties);
  // ['elev', '>=', 50]
  else if (comparator === '<')
    return (input: InputCondition, properties: Properties): boolean =>
      input < buildValue(value, properties);
  // ['elev', '<', 50]
  else if (comparator === '<=')
    return (input: InputCondition, properties: Properties): boolean =>
      input <= buildValue(value, properties);
  // ['elev', '<=', 50]
  else if (comparator === 'has')
    return (input: InputCondition, properties: Properties): boolean =>
      Array.isArray(value) || typeof value === 'string'
        ? (buildValue(value, properties) as string | number[]).includes(input as never)
        : false;
  // ['class', 'has', ['ocean', 'river']] OR ['elev', 'in', [2, 3, 4, 5]]
  else if (comparator === '!has')
    return (input: InputCondition, properties: Properties): boolean =>
      Array.isArray(value) || typeof value === 'string'
        ? !(buildValue(value, properties) as string | number[]).includes(input as never)
        : true;
  // ['class', '!has', ['ocean', 'river']] OR ['elev', '!in', [2, 3, 4, 5]]
  else if (comparator === 'in')
    return (input: InputCondition): boolean =>
      Array.isArray(input) && typeof value === typeof input[0]
        ? input.includes(value as never)
        : false;
  // ['elev', 'in', 50]
  else if (comparator === '!in')
    return (input: InputCondition): boolean =>
      Array.isArray(input) && typeof value === typeof input[0]
        ? !input.includes(value as never)
        : true;
  // ['class', '!in', 'ocean'] OR ['elev', '!in', 50]
  else return () => false;
}

/**
 * Build a value from a string or an array of strings
 * @param value - input value
 * @param properties - properties to coalesce
 * @returns the built value
 */
function buildValue(value?: NotNullOrObject, properties: Properties = {}): NotNullOrObject {
  if (typeof value === 'string' || (Array.isArray(value) && typeof value[0] === 'string'))
    return coalesceField(value as string | string[], properties);
  return value as NotNullOrObject;
}
