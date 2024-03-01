/**
 * @module vite-plugin-wgsl
 * @author Ustym Ukhman <ustym.ukhman@gmail.com>
 * @source https://github.com/UstymUkhman/vite-plugin-wgsl
 * @description Import, inline (and compress) WGSL shader files
 * @version 1.2.1
 * @license MIT
 */

import { createFilter } from '@rollup/pluginutils'
import { transformWithEsbuild } from 'vite'
import parse from './parse.js'

/**
 * @const
 * @default
 * @readonly
 * @type {string}
 */
const DEFAULT_EXTENSION = 'wgsl'

/**
 * @const
 * @default
 * @readonly
 * @type {readonly RegExp[]}
 */
const DEFAULT_SHADERS = Object.freeze(['**/*.wgsl'])

/**
 * @function
 * @name wgsl
 * @description Plugin entry point to import,
 * inline, (and compress) WGSL shader files
 *
 * @see {@link https://vitejs.dev/guide/api-plugin.html}
 * @link https://github.com/UstymUkhman/vite-plugin-wgsl
 *
 * @param {PluginOptions} options Plugin config object
 *
 * @returns {Plugin} Vite plugin that converts shader code
 */
export default function ({
  include = DEFAULT_SHADERS,
  exclude = undefined,
  warnDuplicatedImports = true,
  defaultExtension = DEFAULT_EXTENSION,
  compress = false,
  watch = true,
  root = '/'
} = {}
) {
  let config
  const filter = createFilter(include, exclude)
  const prod = process.env.NODE_ENV === 'production'

  return {
    enforce: 'pre',
    name: 'vite-plugin-wgsl',

    configResolved (resolvedConfig) {
      config = resolvedConfig
    },

    async transform (source, shader) {
      if (!filter(shader)) return

      return await transformWithEsbuild(parse(shader, source), shader, {
        sourcemap: config.build.sourcemap && 'external',
        loader: 'ts',
        format: 'esm',
        minifyWhitespace: prod
      })
    }
  }
}
