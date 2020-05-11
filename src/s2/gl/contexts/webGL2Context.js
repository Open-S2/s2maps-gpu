// @flow
import Context from './context'

export default class WebGL2Context extends Context {
  constructor (context: WebGL2RenderingContext) {
    super(context)
    // let the painter know it's a WebGL2Context
    this.type = 2
    // create a default quad
    this._createDefaultQuad()
  }
}
