import webpack from 'webpack'
const { RuntimeGlobals, RuntimeModule } = webpack

export default class CorsWorkerPublicPathRuntimeModule extends RuntimeModule {
  constructor (publicPath) {
    super('publicPath', RuntimeModule.STAGE_BASIC)
    this.publicPath = publicPath
  }

  /**
   * @returns {string} runtime code
   */
  generate () {
    const { compilation, publicPath } = this
    const isAbsolutePublicPath = (publicPath || '').indexOf('://') > 0

    return `${RuntimeGlobals.publicPath} = ${
      isAbsolutePublicPath ? '' : '(__webpack_worker_origin__ || "") + '
    }${JSON.stringify(
      compilation.getPath(publicPath || '', {
        hash: compilation.hash || 'XXXX'
      })
    )};`
  }
}
