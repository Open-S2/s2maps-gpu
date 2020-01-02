// @flow
// examples:
// "filter": ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
// "filter": ["all", ["class", "==", "ocean"], ["class", "==", "lake"], ["class", "!=", "river"]]
export default function parseFilter (filter: null | Array<string | Array<any>>) {
  if (!filter) return () => true
  // first attribute describes how if we have a bunch of && or ||
  const andOr = (filter[0] === 'any' || filter[0] === 'all') ? filter.shift() : null
  if (!andOr) {
    const [key, condition, value] = filter
    const filterLambda = parseFilterCondition(condition, value)
    return (properties) => {
      if (properties && properties[key] != null) return filterLambda(properties[key])
    }
  }
  // first create all conditionals
  const conditionals = []
  for (const input of filter) {
    const [key, condition, value] = input
    if (key === 'any' || key === 'all') {
      conditionals.push({ condition: parseFilter(input) })
    } else {
      conditionals.push({
        key,
        condition: parseFilterCondition(condition, value)
      })
    }
  }
  // if any, join all conditionals into an array, if "any" as soon as we see a true, return true
  // if "all" than ensure all cases return true
  if (andOr === 'any') {
    return (properties: Object) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (properties[condition.key] != null && condition.condition(properties[condition.key])) return true
        } else if (condition.condition(properties)) return true
      }
      return false
    }
  } else { // andOr === 'all'
    return (properties: Object) => {
      for (const condition of conditionals) {
        if (condition.key) {
          if (properties[condition.key] == null || !condition.condition(properties[condition.key])) return false
        } else if (!condition.condition(properties)) return false
      }
      return true
    }
  }
}

function parseFilterCondition (condition: string, value: string | number | Array<string | number>) {
  // manage multiple conditions
  if (condition === "==") return (input) => input === value // ["class", "==", "ocean"] OR ["elev", "==", 50]
  else if (condition === "!=") return (input) => input !== value // ["class", "!=", "ocean"] OR ["elev", "!=", 50]
  else if (condition === ">") return (input) => input > value // ["elev", ">", 50]
  else if (condition === ">=") return (input) => input >= value // ["elev", ">=", 50]
  else if (condition === "<") return (input) => input < value // ["elev", "<", 50]
  else if (condition === "<=") return (input) => input <= value // ["elev", "<=", 50]
  else if (condition === "has") return (input) => value.includes(input) // ["class", "has", ["ocean", "river"]] OR ["elev", "in", [2, 3, 4, 5]]
  else if (condition === "!has") return (input) => !value.includes(input) // ["class", "!has", ["ocean", "river"]] OR ["elev", "!in", [2, 3, 4, 5]]
  else return () => false
}
