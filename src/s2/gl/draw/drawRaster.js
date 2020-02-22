// @flow
import Painter from '../painter'
import { RasterProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawRaster (painter: Painter, length: number, texture: WebGLTexture) {
  // setup variables
  const { context, indexSize } = painter
  const { gl } = context
  const rasterProgram: RasterProgram = painter.getProgram('raster')
  if (!rasterProgram) return
  // setup the texture
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // draw elements
  gl.drawElements(gl.TRIANGLE_STRIP, length, indexSize, 0)
}
