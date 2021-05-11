// @flow
/**
Coalesce text layout property "field"

examples:

// const properties = { abbr: 'U.S.', name: 'United States', ... }
// const field = ["\"", "?abbr,?name", "\""] - here we coallese to abbr if the property exists, otherwise we fallback on name
cooalesceField(field) // returns '"U.S."' or 'United States' depending on whether abbr exists

// const properties = { type: 'airplane', ... }
// const field = ["?type", "-16"]
cooalesceField(field) // 'airplane-16'
**/

export default function coalesceField (field: string | Array<string>, properties: Object): string {
  if (Array.isArray(field)) {
    field.unshift('')
    return field.reduce((acc, cur) => { return acc + coalesceText(cur, properties) })
  } else { return coalesceText(field, properties) }
}

function coalesceText (field: string, properties: Object): string {
  if (field[0] === '?') {
    // corner case - use defined that they needed to start with a ?
    if (field[1] === '?') return field.slice(1)
    const pieces = field.split(',')
    for (const piece of pieces) {
      let charIndex = 1
      let nextChar = piece[charIndex]
      let transform = (input) => { return input }
      if (nextChar === '!') {
        charIndex++
        nextChar = piece[charIndex]
        charIndex++
        if (nextChar === 'U') transform = (input) => { return input.toUpperCase() } // all uppercase
        else if (nextChar === 'L') transform = (input) => { return input.toLowerCase() } // all lowercase
        else if (nextChar === 'C') transform = (input) => { return input.split(' ').map(i => i[0].toUpperCase() + i.slice(1).toLowerCase()).join(' ') } // first letter capitalized, rest lower
        else charIndex -= 2
      }
      const key = piece.slice(charIndex)
      if (properties[key] !== undefined) return transform('' + properties[key])
    }
    return ''
  } else { return field }
}
