// @flow
import {
  parseDataCondition,
  parseDataRange,
  parseInputRange
} from './'

const noop = () => {}

export default function encodeFeatureFunction (input: void | Array<any>) {
  if (!input) {
    return noop
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      return parseDataCondition(input)
    } else if (conditionType === 'data-range') {
      return parseDataRange(input)
    } else if (conditionType === 'input-range') {
      input.shift() // input-range type
      return parseInputRange(input)
    } else {
      const data = [conditionType, ...input]
      return () => data
    }
  } else { return () => input } // the draw thread will naturally handle the appropraite color/number
}
