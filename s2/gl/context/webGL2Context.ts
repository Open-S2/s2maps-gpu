import Context from './context';

import type { MapOptions } from 'ui/s2mapUI';
import type { Painter } from '../painter.spec';

/** WEBGL2 context class */
export default class WebGL2Context extends Context {
  /**
   * Ensure the context is a WebGL2 context
   * @param context - WebGL2RenderingContext
   * @param options - map options
   * @param painter - painter
   */
  constructor(context: WebGL2RenderingContext, options: MapOptions, painter: Painter) {
    super(context, options, painter);
    // let the painter know it's a WebGL2Context
    this.type = 2;
    // create a default quad
    this._createDefaultQuad();
  }
}
