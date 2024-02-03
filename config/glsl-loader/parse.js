/* eslint-disable no-useless-escape */
const fs = require('fs')

module.exports = function (path, contents) {
  const json = parse(path, contents)

  return `export default ${JSON.stringify(json)}`
}

/** PARSE **/
// let CHAR_POS = 0

// const attrUnif = new Set(['in', 'out', 'attribute', 'uniform'])

// const variableDefs = new Set([
//   // Basic types
//   'bool', 'double', 'float', 'int', 'uint',
//   // Vector types
//   'vec2', 'vec3', 'vec4',
//   'bvec2', 'bvec3', 'bvec4',
//   'dvec2', 'dvec3', 'dvec4',
//   'ivec2', 'ivec3', 'ivec4',
//   'uvec2', 'uvec3', 'uvec4',
//   // Matrix types
//   'mat2', 'mat2x2', 'mat2x3', 'mat2x4',
//   'mat3', 'mat3x2', 'mat3x3', 'mat3x4',
//   'mat4', 'mat4x2', 'mat4x3', 'mat4x4',
//   // Sampler types
//   'sampler1D', 'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DRect',
//   'isampler1D', 'isampler2D', 'isampler3D', 'isamplerCube', 'isampler2DRect',
//   'usampler1D', 'usampler2D', 'usampler3D', 'usamplerCube', 'usampler2DRect',
//   // sampler array types
//   'sampler1DArray', 'sampler2DArray', 'samplerCubeArray',
//   'isampler1DArray', 'isampler2DArray', 'isamplerCubeArray',
//   'usampler1DArray', 'usampler2DArray', 'usamplerCubeArray',
//   // sample buffers
//   'samplerBuffer', 'sampler2DMS', 'sampler2DMSArray',
//   'isamplerBuffer', 'isampler2DMS', 'isampler2DMSArray',
//   'usamplerBuffer', 'usampler2DMS', 'usampler2DMSArray',
//   // sample shadows
//   'sampler1DShadow', 'sampler2DShadow', 'samplerCubeShadow', 'sampler2DRectShadow', 'sampler1DArrayShadow',
//   'sampler2DArrayShadow', 'samplerCubeArrayShadow',
//   // void
//   'void'
// ])

const constants = new Set([
  'gl_FragColor', 'gl_Position',
  // Basic types
  'bool', 'double', 'float', 'int', 'uint',
  // Vector types
  'vec2', 'vec3', 'vec4',
  'bvec2', 'bvec3', 'bvec4',
  'dvec2', 'dvec3', 'dvec4',
  'ivec2', 'ivec3', 'ivec4',
  'uvec2', 'uvec3', 'uvec4',
  // Matrix types
  'mat2', 'mat2x2', 'mat2x3', 'mat2x4',
  'mat3', 'mat3x2', 'mat3x3', 'mat3x4',
  'mat4', 'mat4x2', 'mat4x3', 'mat4x4',
  // Sampler types
  'sampler1D', 'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DRect',
  'isampler1D', 'isampler2D', 'isampler3D', 'isamplerCube', 'isampler2DRect',
  'usampler1D', 'usampler2D', 'usampler3D', 'usamplerCube', 'usampler2DRect',
  // sampler array types
  'sampler1DArray', 'sampler2DArray', 'samplerCubeArray',
  'isampler1DArray', 'isampler2DArray', 'isamplerCubeArray',
  'usampler1DArray', 'usampler2DArray', 'usamplerCubeArray',
  // sample buffers
  'samplerBuffer', 'sampler2DMS', 'sampler2DMSArray',
  'isamplerBuffer', 'isampler2DMS', 'isampler2DMSArray',
  'usamplerBuffer', 'usampler2DMS', 'usampler2DMSArray',
  // sample shadows
  'sampler1DShadow', 'sampler2DShadow', 'samplerCubeShadow', 'sampler2DRectShadow', 'sampler1DArrayShadow',
  'sampler2DArrayShadow', 'samplerCubeArrayShadow',
  // void
  'void',
  // Other type-related keywords
  'attribute', 'const', 'invariant', 'struct', 'uniform', 'varying',
  'layout', 'location',
  // Precision keywords
  'highp', 'lowp', 'mediump', 'precision',
  // Input/output keywords
  'in', 'inout', 'out',
  // Interpolation qualifiers
  'flat', 'noperspective', 'smooth', 'centroid', 'sample',
  // Memory qualifiers
  'coherent', 'volatile', 'restrict', 'readonly', 'writeonly',
  // Trig functions
  'acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'cos', 'cosh', 'degrees',
  'radians', 'sin', 'sinh', 'tan', 'tanh',
  // Exponents and logarithms
  'exp', 'exp2', 'inversesqrt', 'log', 'log2', 'pow', 'sqrt',
  // Clamping and modulus-related funcions
  'abs', 'ceil', 'clamp', 'floor', 'fract', 'max', 'min', 'mod', 'modf', 'round',
  'roundEven', 'sign', 'trunc',
  // Floating point functions
  'isinf', 'isnan',
  // Boolean functions
  'all', 'any', 'equal', 'greaterThan', 'greaterThanEqual', 'lessThan', 'lessThanEqual', 'not', 'notEqual',
  // Vector functions
  'cross', 'distance', 'dot', 'faceforward', 'length', 'outerProduct', 'normalize', 'reflect', 'refract',
  // Matrix functions
  'determinant', 'inverse', 'matrixCompMult',
  // Interpolation functions
  'mix', 'step', 'smoothstep',
  // Texture functions
  'texture', 'texture2D', 'texture2DProj', 'textureCube', 'textureSize',
  // Noise functions
  'noise1', 'noise2', 'noise3', 'noise4',
  // Derivative functions
  'dFdx', 'dFdxCoarse', 'dFdxFine',
  'dFdy', 'dFdyCoarse', 'dFdyFine',
  'fwidth', 'fwidthCoarse', 'fwidthFine',
  // booleans
  'false', 'true',
  // Built-in macros
  '__FILE__', '__LINE__', '__VERSION__', 'GL_ES', 'GL_FRAGMENT_PRECISION_HIGH',
  // Control keywords
  'break', 'continue', 'do', 'else', 'for', 'if', 'main', 'return', 'while',
  'discard'
])

const noSpaceChars = new Set([
  ';', ',', '*', '=', '/', '^', '(', '+', '-', '<', '>', '{', '}', '|',
  '?', ':'
])

const SOURCE_MAPS = {}

function parse (id, contents, res = { source: '', uniforms: {}, attributes: {}, variables: { main: 'main' } }) {
  let path = id.split('/')
  path.pop()
  path = path.join('/')

  let shaderName = id.split('/').pop()
  shaderName = shaderName.split('.')[0]
  // console.info(shaderName)

  if (!SOURCE_MAPS[shaderName]) {
    SOURCE_MAPS[shaderName] = {
      uniformMap: new Map(),
      attributeMap: new Map(),
      varMap: new Map(),
      charPos: 0
    }
  }

  _parse(contents, path, res, shaderName)

  // discard the variables object
  delete res.variables

  return res
}

function _parse (contents, path, res, shaderName) {
  // 1) break into lines
  contents = contents.split('\n')

  for (const line of contents) parseLine(line, path, res, shaderName)
}

function parseLine (line, path, res, shaderName) {
  if (line === '#version 300 es') res.source += '#version 300 es\n'
  else if (line.includes('#ifdef') || line.includes('#else')) res.source += line + ' '
  else if (line.includes('precision')) res.source += line
  else if (line.includes('#endif')) res.source += line + '\n'
  else if (line.includes('@import')) _importCode(line, path, res, shaderName)
  else if (line.includes('@define')) _define(line, res)
  else _parseLine(line, res, shaderName)
}

function _importCode (line, path, res, shaderName) {
  const file = line.split('"')[1]
  const filePath = `${path}/${file}`
  const contents = fs.readFileSync(filePath, 'utf8')

  _parse(contents, path, res, shaderName)
}

function _define (line, res) {
  const [, key, value] = line.split(' ')
  res.variables[key] = value
}

function _parseLine (line, res, shaderName) {
  const commentIndex = line.indexOf('\/\/')
  if (commentIndex >= 0) line = line.slice(0, commentIndex)
  line = line.trim()
  if (line === 'void main () {') res.source += 'void main(){'
  else if (line === 'void main ()') res.source += 'void main()'
  else _parseWords(line.split(' '), res, shaderName)
}

function _parseWords (words, res, shaderName) {
  // const { attributeMap, uniformMap, varMap } = SOURCE_MAPS[shaderName]
  const { attributeMap, uniformMap } = SOURCE_MAPS[shaderName]
  if (words.length === 1 && words[0] === '') return

  const size = words.length
  for (let i = 0; i < size; i++) {
    let word = words[i]
    const endChar = word[word.length - 1]

    // build and/or replace
    if (word === 'in' || word === 'out' || word === 'attribute' || word === 'varying') {
      const attr = words[i + 2].replace(/;|,|\)/g, '')
      if (!res.attributes[attr]) {
        let value
        if (attributeMap.has(attr)) {
          value = attributeMap.get(attr)
        } else { value = 'a' + newChar(SOURCE_MAPS[shaderName]) }
        res.attributes[attr] = value
        attributeMap.set(attr, value)
      }
    } else if (word === 'uniform') {
      let unifm = words[i + 2].replace(/;|,|\)/g, '')
      if (unifm.includes('[')) unifm = unifm.split('[')[0]
      // console.info(unifm, uniformMap.has(unifm), res.uniforms[unifm])
      if (!res.uniforms[unifm]) {
        let value
        if (uniformMap.has(unifm)) {
          value = uniformMap.get(unifm)
        } else {
          value = 'u' + newChar(SOURCE_MAPS[shaderName])
          uniformMap.set(unifm, value)
        }
        res.uniforms[unifm] = value
      }
    }
    // else if (
    //   variableDefs.has(word) &&
    //   (i - 1 < 0 || !attrUnif.has(words[i - 1])) &&
    //   words[i + 1].length > 4
    // ) {
    //   let varb = words[i + 1].replace(';', '').replace(')', '').replace(',', '')
    //   if (varb.includes('[')) varb = varb.split('[')[0]
    //   if (varb.includes('(')) varb = varb.split('(')[0]
    //   if (!res.variables[varb]) {
    //     let value
    //     if (varMap.has(varb)) {
    //       value = varMap.get(varb)
    //     } else { value = 'v' + newChar() }
    //     res.variables[varb] = value
    //     varMap.set(varb, value)
    //   }
    // }
    // replace
    for (const key in res.attributes) word = word.replace(key, res.attributes[key])
    for (const key in res.uniforms) word = word.replace(key, res.uniforms[key])
    for (const key in res.variables) word = word.replace(key, res.variables[key])

    // clean
    if (noSpaceChars.has(endChar)) {
      res.source += word
    } else if (i + 1 < size && noSpaceChars.has(words[i + 1][0])) {
      res.source += word
    } else if (constants.has(word)) {
      res.source += word + ' '
    } else {
      res.source += word + ' '
    }
  }
}

function getMinifiedName (tokenCount) {
  const res = []
  while (tokenCount > 51) {
    res.push('Z')
    tokenCount -= 51
  }
  // if above 25, capitols
  if (tokenCount > 25) {
    tokenCount -= 26
    res.push(String.fromCharCode(65 + tokenCount).toLowerCase())
  } else {
    res.push(String.fromCharCode(65 + tokenCount))
  }

  return res.join('')
}

function newChar (source) {
  const token = source.charPos
  source.charPos++
  return getMinifiedName(token)
}
