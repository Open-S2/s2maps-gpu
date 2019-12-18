// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawMask (painter: Painter, length: number) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  // setup the mask
  context.enableStencil()
  // draw elements
  gl.drawElements(gl.TRIANGLE_STRIP, length, gl.UNSIGNED_INT, 0)
  // lock the mask in
  context.lockStencil()
}
