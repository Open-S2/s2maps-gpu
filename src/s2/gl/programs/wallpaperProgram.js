// @flow
import { WebGL2Context, WebGLContext } from '../contexts'
import Program from './program'

import wallpaperVertex from '../../shaders/wallpaper.vertex.glsl'
import wallpaperFragment from '../../shaders/wallpaper.fragment.glsl'

export default class WallpaperProgram extends Program {
  aPos: GLint // 'a_pos' vec4 attribute
  uScale: GLint // 'u_scale' vec2 uniform
  backgroundColor: GLint
  haloColor: GLint
  fade1Color: GLint
  fade2Color: GLint
  constructor (context: WebGL2Context | WebGLContext) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, wallpaperVertex, wallpaperFragment)
    // acquire the attributes
    this.aPos = gl.getAttribLocation(this.glProgram, 'aPos')
    this.uScale = gl.getUniformLocation(this.glProgram, 'uScale')
    this.backgroundColor = gl.getUniformLocation(this.glProgram, 'backgroundColor')
    this.haloColor = gl.getUniformLocation(this.glProgram, 'haloColor')
    this.fade1Color = gl.getUniformLocation(this.glProgram, 'fade1Color')
    this.fade2Color = gl.getUniformLocation(this.glProgram, 'fade2Color')
    // create a vertex array object
    this.vao = context.createVertexArray()
    // Create a vertex buffer
    this.vertexBuffer = gl.createBuffer()
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertexBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,   1, -1,   1, 1,   -1, 1]), gl.STATIC_DRAW)
    // Turn on the attribute
    gl.enableVertexAttribArray(this.aPos)
    // tell attribute how to get data out of vertexBuffer
    // (attribute pointer, compenents per iteration (size), data size (type), normalize, stride, offset)
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0)
  }
}
