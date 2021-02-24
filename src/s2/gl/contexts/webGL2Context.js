// @flow
/* global WebGL2RenderingContext */
import Context from './context'

import type { MapOptions } from '../../ui/map'

export default class WebGL2Context extends Context {
  constructor (context: WebGL2RenderingContext, options: MapOptions) {
    super(context, options)
    // let the painter know it's a WebGL2Context
    this.type = 2
    // create a default quad
    this._createDefaultQuad()
  }
}
