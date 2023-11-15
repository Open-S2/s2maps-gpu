import { validate } from 'schema-utils'
import { transpileGLSL } from '@use-gpu/shader/glsl'

const LOADER_NAME = 'WGSL Loader'

const schema = {
  type: 'object',
  properties: {}
}

export default function wgslLoader (input, source) {
  // Parse options
  const options = input.getOptions()
  validate(schema, options, {
    name: LOADER_NAME,
    baseDataPath: 'options'
  })

  const esModule = options.esModule != null ? options.esModule : true
  const minify = options.minify != null ? options.minify : false
  const { resourcePath } = input

  return transpileWGSL(source, resourcePath, esModule, minify)
}
