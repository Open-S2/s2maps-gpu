// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/wallpaper1.vertex.glsl'
import frag1 from '../../shaders/wallpaper1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/wallpaper2.vertex.glsl'
import frag2 from '../../shaders/wallpaper2.fragment.glsl'

import type { Context } from '../contexts'

export default class WallpaperProgram extends Program {
  vao: VertexArrayObject
  vertexBuffer: WebGLVertexArrayObject
  aPos: GLint // 'a_pos' vec4 attribute
  uScale: WebGLUniformLocation // 'u_scale' vec2 uniform
  uBackgroundColor: WebGLUniformLocation
  uHaloColor: WebGLUniformLocation
  uFade1Color: WebGLUniformLocation
  uFade2Color: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // install shaders
    if (type === 1) super(context, vert1, frag1, false)
    else super(context, vert2, frag2, false)
    // acquire the attributes & uniforms
    this.aPos = gl.getAttribLocation(this.glProgram, 'aPos')
    this.uScale = gl.getUniformLocation(this.glProgram, 'uScale')
    this.uBackgroundColor = gl.getUniformLocation(this.glProgram, 'backgroundColor')
    this.uHaloColor = gl.getUniformLocation(this.glProgram, 'haloColor')
    this.uFade1Color = gl.getUniformLocation(this.glProgram, 'fade1Color')
    this.uFade2Color = gl.getUniformLocation(this.glProgram, 'fade2Color')
    // create a vertex array object
    this.vao = gl.createVertexArray()
    // bind the vao so we can work on it
    gl.bindVertexArray(this.vao)
    // Create a vertex buffer
    this.vertexBuffer = gl.createBuffer()
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertexBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  1, -1,  1, 1,  -1, 1]), gl.STATIC_DRAW)
    // Turn on the attribute
    gl.enableVertexAttribArray(this.aPos)
    // tell attribute how to get data out of vertexBuffer
    // (attribute pointer, compenents per iteration (size), data size (type), normalize, stride, offset)
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0)
    // clear vao
    gl.bindVertexArray(null)
  }

  draw (wallpaper: Wallpaper) {
    // setup variables
    const { context } = this
    const { gl } = context
    // now we draw
    gl.useProgram(this.glProgram)
    // ensure we are using equal depth test like rasters
    context.lequalDepth()
    // set new uniforms should we need to
    const uniforms: null | WallpaperUniforms = wallpaper.getUniforms()
    if (uniforms) {
      gl.uniform2fv(this.uScale, uniforms.uScale)
      gl.uniform4fv(this.uBackgroundColor, uniforms.uBackgroundColor)
      gl.uniform4fv(this.uFade1Color, uniforms.uFade1Color)
      gl.uniform4fv(this.uFade2Color, uniforms.uFade2Color)
      gl.uniform4fv(this.uHaloColor, uniforms.uHaloColor)
    }
    wallpaper.dirty = false
    context.drawQuad()
  }
}
