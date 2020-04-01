// @flow
import Painter from '../painter'
import { LineProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawLine (painter: Painter, segmentLength: number,
  segmentOffset: number, featureEncoding?: null | Float32Array, mode?: GLenum) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const lineProgram: LineProgram = painter.getProgram('line')
  if (!lineProgram) return
  // set feature code
  if (featureEncoding && featureEncoding.length) gl.uniform1fv(lineProgram.uFeatureCode, featureEncoding)
  // get mode
  if (!mode) mode = gl.TRIANGLES
  // draw elements
  gl.drawElements(mode, segmentLength, gl.UNSIGNED_INT, segmentOffset * 4)
}
