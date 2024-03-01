import webpack from 'webpack'
import CorsWorkerPublicPathRuntimeModule from './CorsWorkerPublicPathRuntimeModule.js'

const { RuntimeGlobals } = webpack

export default class CorsWorkerPlugin {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply (compiler) {
    compiler.hooks.compilation.tap(
      'CorsWorkerPlugin',
      /**
       * @param {import('webpack').Compilation} compilation
       */
      compilation => {
        const getChunkLoading = chunk => {
          const entryOptions = chunk.getEntryOptions()
          return entryOptions &&
                        entryOptions.chunkLoading !== undefined
            ? entryOptions.chunkLoading
            : compilation.outputOptions.chunkLoading
        }
        const getChunkPublicPath = chunk => {
          const entryOptions = chunk.getEntryOptions()
          return entryOptions && entryOptions.publicPath !== undefined
            ? entryOptions.publicPath
            : compilation.outputOptions.publicPath
        }

        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.publicPath)
          .tap('CorsWorkerPlugin', chunk => {
            if (getChunkLoading(chunk) === 'import-scripts') {
              const publicPath = getChunkPublicPath(chunk)

              if (publicPath !== 'auto') {
                const module = new CorsWorkerPublicPathRuntimeModule(
                  publicPath
                )
                compilation.addRuntimeModule(chunk, module)
                return true
              }
            }
          })
      }
    )
  }
}
