// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawMask (painter: Painter, segmentLength: number, segmentOffset: number, matrix: Float32Array) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  // setup the mask
  context.enableStencil()
  // prep the program
  gl.useProgram(fillProgram.glProgram)
  // set the matrix
  gl.uniformMatrix4fv(fillProgram.uMatrix, false, matrix)
  // draw elements
  gl.drawElements(gl.TRIANGLES, segmentLength, gl.UNSIGNED_INT, segmentOffset * 4)
  // lock the mask in
  context.lockStencil()
}
