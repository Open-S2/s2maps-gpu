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
  if (Array.isArray(field)) return field.reduce((acc, cur) => acc + coalesceText(cur, properties))
  else return coalesceText(field, properties)
}

function coalesceText (field: string, properties: Object): string {
  if (field[0] === '?') {
    if (field[1] === '?') return field.slice(1)
    const pieces = field.split(',')
    for (const piece of pieces) {
      const key = piece.slice(1)
      if (properties[key]) return properties[key]
    }
  } else { return field }
}
