// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawMask (painter: Painter, length: number, mode?: GLenum, threeD?: boolean = false) {
  // setup variables
  const { context, indexSize } = painter
  const { gl } = context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  if (threeD) fillProgram._set3D(true)
  // setup the mask
  context.enableStencil()
  // grab mode
  if (!mode) mode = gl.TRIANGLE_STRIP
  // draw elements
  gl.drawElements(mode, length, indexSize, 0)
  // lock the mask in
  context.lockStencil()
}
