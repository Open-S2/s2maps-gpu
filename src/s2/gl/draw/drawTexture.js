// @flow
import Painter from '../painter'
import { TextureProgram } from '../programs'

// NOTE - How drawArraysInstancedANGLE works:
// https://developer.mozilla.org/en-US/docs/Web/API/ANGLE_instanced_arrays/drawArraysInstancedANGLE
export default function drawTexture (painter: Painter, primcount: number, mode: 0 | 1 | 2) {
  // setup variables
  const { context } = painter
  const { gl } = context
  const texProgram: TextureProgram = painter.getProgram('texture')
  if (!texProgram) return
  // set the proper mode
  texProgram.setMode(mode)

  // draw
  if (mode === 0) gl.drawArraysInstanced(gl.POINTS, 0, 1, primcount)
  else gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, primcount)
}
