// @flow
import Painter from '../painter'
// import { FillProgram } from '../programs'

export default function drawFill (painter: Painter, vao, segmentLength) {
  // setup variables
  const { gl } = painter.context
  // bind the approprate data (program and uMatrix have already been assigned)
  gl.bindVertexArray(vao)
  gl.drawElements(gl.TRIANGLES, segmentLength, gl.UNSIGNED_SHORT, 0)
}
