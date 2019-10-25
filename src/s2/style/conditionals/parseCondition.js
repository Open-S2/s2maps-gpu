// @flow
import Color from '../color'

export default function parseCondition (input: null | string | Array<any>) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = dataFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-condition') {
      const parsedDataFunction = zoomFunction(input)
      return parsedDataFunction
    } else { return () => null }
  } else {
    const color = new Color(input) // pre-create the color
    return () => color
  }
}
