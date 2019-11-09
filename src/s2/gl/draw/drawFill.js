// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'
import Color from '../../style/color'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawFill (painter: Painter, segmentLength: number, segmentOffset: number, matrix: Float32Array, color?: Color) {
  // setup variables
  const { gl } = painter.context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  // prep the program
  gl.useProgram(fillProgram.glProgram)
  // set the matrix
  gl.uniformMatrix4fv(fillProgram.matrix, false, matrix)
  // set the color uniform
  if (color) gl.uniform4fv(fillProgram.color, color.getRGB())
  // draw elements
  gl.drawElements(gl.TRIANGLES, segmentLength, gl.UNSIGNED_INT, segmentOffset * 4)
}
