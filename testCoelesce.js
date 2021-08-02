
const prefLan = 'es'

const props = {
  name: 'United States',
  name_en: 'United States of America',
  name_es: 'Unitd Sts'
}

console.log(coalesceField('?!P!U!Lname_XX', props))

function coalesceField (field, properties) {
  if (Array.isArray(field)) {
    return field.reduce((acc, cur) => { return acc + coalesceText(cur, properties) }, '')
  } else { return coalesceText(field, properties) }
}

function coalesceText (field, properties) {
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
        if (nextChar === 'U') transforms.push((input) => { return input.toUpperCase() }) // all uppercase
        else if (nextChar === 'L') transforms.push((input) => { return input.toLowerCase() }) // all lowercase
        else if (nextChar === 'C') transforms.push((input) => { return input.split(' ').map(i => i[0].toUpperCase() + i.slice(1).toLowerCase()).join(' ') }) // first letter capitalized, rest lower
        else if (nextChar === 'P') piece = piece.replaceAll('XX', prefLan)
      }
      const key = piece.slice(charIndex)
      if (properties[key] !== undefined) {
        let res = '' + properties[key]
        for (const transform of transforms) res = transform(res)
        return res
      }
    }
    return ''
  } else { return field }
}
