// @flow
// examples:
// "filter": ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
// "filter": ["all", ["class", "==", "ocean"], ["class", "==", "lake"], ["class", "!=", "river"]]
function filterFunction (filter) {
  // first attribute describes how if we have a bunch of && or ||
  const andOr = filter.shift()
  // first create all conditionals
  const conditionals = {}
  for (input of filter) {
    const [key, condition, value] = input
    conditionals[key] = parseFilterCondition(condition, value)
  }
  // if any, join all conditionals into an array, if "any" as soon as we see a true, return true
  // if "all" than ensure all cases return true
  if (andOr === 'any') {
    return (properties) => {
      for (key in conditionals) {
        if (properties[key] && conditionals[key](properties([key]))) return true
      }
      return false
    }
  } else { // andOr === 'all'
    return (properties) => {
      for (key in conditionals) {
        if (!properties[key] || !conditionals[key](properties[key])) return false
      }
      return true
    }
  }
}

function parseFilterCondition (condition, value) {
  // manage multiple conditions
  if (condition === "==") return (input) => input == value
  else if (condition === "!=") return (input) => input != value
  else if (condition === ">") return (input) => input > value
  else if (condition === ">=") return (input) => input >= value
  else if (condition === "<") return (input) => input < value
  else if (condition === "<=") return (input) => input <= value
}

exports.default = {
  filterFunction,
  parseFilterCondition
}
