// @flow
import Program from './program'

import wallpaperVertex from '../../shaders/wallpaper.vertex.glsl'
import wallpaperFragment from '../../shaders/wallpaper.fragment.glsl'

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
    const { gl } = context
    // upgrade
    super(gl, wallpaperVertex, wallpaperFragment, false)
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
  }
}
