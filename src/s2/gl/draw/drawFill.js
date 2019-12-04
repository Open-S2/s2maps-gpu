// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'
import Color from '../../style/color'

import type { VectorTileSource } from '../../source/tile'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawFill (painter: Painter, source: VectorTileSource, segmentLength: number,
  segmentOffset: number, matrix: Float32Array, color?: Color, mode?: GLenum) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  // set the matrix
  gl.uniformMatrix4fv(fillProgram.matrix, false, matrix)
  // set the color uniform
  if (color) gl.uniform4fv(fillProgram.color, color.getLCH())
  // get mode
  if (!mode) mode = gl.TRIANGLES
  // draw elements
  gl.drawElements(mode, segmentLength, gl.UNSIGNED_INT, segmentOffset * 4)
}
