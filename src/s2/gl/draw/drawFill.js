// @flow
import Painter from '../painter'
import { FillProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawFill (painter: Painter, segmentLength: number,
  segmentOffset: number, featureEncoding?: null | Float32Array, mode?: GLenum) {
  // setup variables
  const { context, indexSize, offsetSize } = painter
  const { gl } = context
  const fillProgram: FillProgram = painter.getProgram('fill')
  if (!fillProgram) return
  // set feature code
  if (featureEncoding && featureEncoding.length) gl.uniform1fv(fillProgram.uFeatureCode, featureEncoding)
  // get mode
  if (!mode) mode = gl.TRIANGLES
  // draw elements
  gl.drawElements(mode, segmentLength, indexSize, segmentOffset * offsetSize)
}
