// @flow
import {
  encodeFeatureFunction,
  parseFilter
} from './'

/**
consider two cases:
one: the data condition results in a color
two: the data condition results in another conditional
// examples:
{ "color": [
     "data-condition",
     ["class", "==", "ocean"],
     "rgba(5, 100, 125, 255)",
     ["class", "==", "river"],
     "rgba(20, 130, 200, 255)",
     "default"
     null
  ],
  "line-width": [
     "data-condition",
     ["class", "==", "ocean"],
     15,
     ["class", "==", "river"],
     ["data-condition", ["elev", "==", 5], 10, "default", 7],
     "default"
     ["input-range", "lin", 3, 5, 7, 10]
  ]
}
**/

export default function parseDataCondition (input) {
  const conditions = []
  let encodeResultID = 1
  while (input.length) {
    if (Array.isArray(input[0])) {
      const filter = input.shift()
      conditions.push({
        key: filter[0],
        encodeID: encodeResultID,
        condition: parseFilter(filter),
        result: encodeFeatureFunction(input.shift())
      })
      encodeResultID++
    } else if (input[0] === 'default') {
      input.shift() // 'default'
      conditions['default'] = encodeFeatureFunction(input.shift())
    }
  }
  if (!conditions['default']) conditions['default'] = () => null // just incase it's missing in the style json
  return (properties, encoding) => {
    if (properties) {
      for (const condition of conditions) { // run through the conditions
        if (condition.condition(properties)) {
          encoding.push(condition.encodeID)
          return condition.result(properties, encoding)
        }
      }
    }
    // if we made it here, just run default
    encoding.push(0)
    return conditions['default'](properties)
  }
}
