// @flow
import Painter from '../painter'
import { MaskProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawMask (painter: Painter, length: number, texture: WebGLTexture, mode: GLenum) {
  // setup variables
  const { context, indexSize } = painter
  const { gl } = context
  const maskProgram: MaskProgram = painter.getProgram('mask')
  if (!maskProgram) return
  // set the texture
  maskProgram.setTexture(texture)
  // draw elements
  gl.drawElements(mode, length, indexSize, 0)
}
