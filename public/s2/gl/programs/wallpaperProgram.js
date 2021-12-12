// @flow
/* eslint-env browser */
/* global GLint */
import Program from './program'

// WEBGL1
import vert1 from '../shaders/wallpaper1.vertex.glsl'
import frag1 from '../shaders/wallpaper1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/wallpaper2.vertex.glsl'
import frag2 from '../shaders/wallpaper2.fragment.glsl'

import type { Context } from '../contexts'
import type { Wallpaper, WallpaperUniforms } from '../../source/wallpaper'

export default class WallpaperProgram extends Program {
  aPos: GLint // 'a_pos' vec4 attribute
  uScale: WebGLUniformLocation // 'u_scale' vec2 uniform
  uBackgroundColor: WebGLUniformLocation
  uHaloColor: WebGLUniformLocation
  uFade1Color: WebGLUniformLocation
  uFade2Color: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { type } = context
    // inject Program
    super(context)
    // install shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
  }

  draw (wallpaper: Wallpaper) {
    // setup variables
    const { context, gl } = this
    // ignore z-fighting and only pass where stencil is 0
    context.wallpaperState()
    // ensure we are using equal depth test like rasters
    // set new uniforms should we need to
    const uniforms: null | WallpaperUniforms = wallpaper.getUniforms()
    if (uniforms) {
      gl.uniform2fv(this.uScale, uniforms.uScale)
      gl.uniform4fv(this.uBackgroundColor, uniforms.uBackgroundColor)
      gl.uniform4fv(this.uFade1Color, uniforms.uFade1Color)
      gl.uniform4fv(this.uFade2Color, uniforms.uFade2Color)
      gl.uniform4fv(this.uHaloColor, uniforms.uHaloColor)
    }
    context.drawQuad()
  }
}
