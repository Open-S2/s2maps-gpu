// @flow
import Painter from '../painter'
import { ShadeProgram } from '../programs'

import type { ShadeUniforms } from '../../source/shade'

// NOTE: https://stackoverflow.com/questions/10221647/how-do-i-use-webgl-drawelements-offset
// offsets are multiples of the type, so if UNSIGNED_INT, than its 4, however UNSIGNED_SHORT is 2
export default function drawShade (painter: Painter, shade: Shade) {
  // setup variables
  const { gl } = painter.context
  const shadeProgram: ShadeProgram = painter.getProgram('shade')
  if (!shadeProgram) return
  // now we draw
  gl.useProgram(shadeProgram.glProgram)
  // bind the vao
  painter.context.bindVertexArray(shadeProgram.vao)
  // set new uniforms should we need to
  const uniforms: null | ShadeUniforms = shade.getUniforms()
  // console.log('uniforms',uniforms)
  if (uniforms) {
    gl.uniform2fv(shadeProgram.radius, uniforms.uRadius)
    gl.uniform2fv(shadeProgram.offset, uniforms.uOffset)
  }
  shade.dirty = false
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
}
