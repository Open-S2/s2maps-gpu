import type { Properties } from 's2projection'

/**
Coalesce text layout property "field"

examples:

// const properties = { abbr: 'U.S.', name: 'United States', ... }
// const field = ["\"", "?abbr,?name", "\""] - here we coallese to abbr if the property exists, otherwise we fallback on name
cooalesceField(field) // returns "U.S." or "United States" depending on whether abbr exists

// const properties = { type: 'airplane', ... }
// const field = ["?type", "-16"]
cooalesceField(field) // 'airplane-16'
**/
const language = navigator.language.split('-')[0] ?? 'en'

export default function coalesceField (
  field: string | string[],
  properties: Properties,
  fieldIsKey = false
): string {
  if (Array.isArray(field)) {
    return field.reduce((acc, cur) => { return acc + coalesceText(cur, properties, fieldIsKey) }, '')
  } else { return coalesceText(field, properties, fieldIsKey) }
}

function coalesceText (field: string, properties: Properties, fieldIsKey: boolean): string {
  if (field[0] === '?') {
    // corner case - use defined that they needed to start with a ?
    if (field[1] === '?') return field.slice(1)
    const pieces = field.split(',')
    for (let piece of pieces) {
      // prep variables
      let charIndex = 1
      let nextChar
      const transforms = []
      while (piece[charIndex] === '!') {
        charIndex++
        nextChar = piece[charIndex]
        charIndex++
        if (nextChar === 'U') transforms.push((input: string): string => { return input.toUpperCase() }) // all uppercase
        else if (nextChar === 'L') transforms.push((input: string): string => { return input.toLowerCase() }) // all lowercase
        else if (nextChar === 'C') transforms.push((input: string): string => { return input.split(' ').map(i => i[0].toUpperCase() + i.slice(1).toLowerCase()).join(' ') }) // first letter capitalized, rest lower
        else if (nextChar === 'P') piece = piece.replaceAll('XX', language)
      }
      const key = piece.slice(charIndex)
      if (properties[key] !== undefined) {
        let res = String(properties[key])
        for (const transform of transforms) res = transform(res)
        return res
      }
    }
    return ''
  } else {
    return (fieldIsKey ? properties[field] : field) as string
  }
}
