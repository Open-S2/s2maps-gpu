// @flow
import Context from './context'

export default class WebGL2Context extends Context {
  constructor (context: WebGL2RenderingContext) {
    super(context)
    this.type = 2
    this._createDefaultQuad()
  }
}
