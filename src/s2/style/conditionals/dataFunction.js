// @flow
import parseCondition from './parseCondition'
import zoomFunction from './zoomFunction'
import { parseFilterCondition } from './filterFunction'

// consider two cases:
// one: the data condition results in a color
// two: the data condition results in another conditional
// examples:
// { color: [
//    "data-condition",
//    ["class", "==", "ocean"],
//    "rgba(5, 100, 125, 255)",
//    ["class", "==", "river"],
//    ["zoom-condition", "linear", 0, "rgba(0, 0, 0, 0)", 5, "rgba(5, 100, 125, 200)", 10, "rgba(20, 130, 200, 255)"]],
//    "default"
//    null
// }

// if this function was called, input[0] has already been shifted and "data-condition" has been removed
export default function dataFunction (input: Array<string | Array<any> | null>) {
  const conditions = {}
  while (input.length) {
    if (Array.isArray(input[0])) {
      const [key, condition, value] = input.shift()
      const result = parseCondition(input.shift())
      conditions[key] = {
        condition: parseFilterCondition(key, condition, value),
        result
      }
    } else if (input[0] === 'default') {
      const result = parseCondition(input.shift())
      conditions[input.shift()] = result
    }
  }
  if (!conditions['default']) conditions['default'] = parseCondition(null) // just incase it's missing in the style json
  return (properties: Object, zoom: number) => {
    for (let key in conditions) { // run through the conditions
      if (properties[key] && conditions[key].condition(properties[key])) {
        return conditions[key].result(properties, zoom)
      }
    }
    // if we made it here, just run default
    return conditions['default'].result(properties, zoom)
  }
}
