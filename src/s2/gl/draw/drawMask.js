// @flow
import Painter from '../painter'
import { FillProgram, TextureProgram } from '../programs'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawMask (painter: Painter, fillProgram: FillProgram,
  mask: Object) {
  // setup variables
  let { indexArray, mode, threeD } = mask
  const { context } = painter
  const { gl } = context

  if (threeD) fillProgram._set3D(true)
  // setup the mask
  context.enableStencil()
  // grab mode
  if (!mode) mode = gl.TRIANGLE_STRIP
  // draw elements
  gl.drawElements(mode, indexArray.length, gl.UNSIGNED_INT, 0)

  // if we have the texture program, we need to also draw a depth "mask"
  const texProgram: undefined | TextureProgram = painter.programs.texture
  if (texProgram) {
    // use the program's point framebuffer
    texProgram.bindPointFrameBuffer()
    // draw elements
    gl.drawElements(mode, indexArray.length, gl.UNSIGNED_INT, 0)
    // return to our main framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // lock the mask in
  context.lockStencil()
}
