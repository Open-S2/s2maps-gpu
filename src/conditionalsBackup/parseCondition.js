// @flow
const Color = require('./color').default
const { dataConditionFunction, dataRangeFunction } = require('./dataFunction').default
const zoomRangeFunction = require('./zoomFunction').default

function parseCondition (input) {
  if (!input) {
    return () => null
  } else if (Array.isArray(input)) { // we hit a conditional
    const conditionType = input.shift()
    if (conditionType === 'data-condition') {
      const parsedDataFunction = dataConditionFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'data-range') {
      const parsedDataFunction = dataRangeFunction(input)
      return parsedDataFunction
    } else if (conditionType === 'zoom-condition') {
      const parsedZoomFunction = zoomRangeFunction(input)
      return parsedZoomFunction
    } else { return () => null }
  } else {
    if (isNaN(input)) {
      const color = new Color(input) // pre-create the color
      return () => color
    } else {
      return () => input
    }
  }
}

exports.default = parseCondition
