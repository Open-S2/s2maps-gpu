// @flow
import Program from './program'

import shadeVertex from '../../shaders/shade.vertex.glsl'
import shadeFragment from '../../shaders/shade.fragment.glsl'

import type { Context } from '../contexts'

export default class ShadeProgram extends Program {
  vao: VertexArrayObject
  vertexBuffer: WebGLVertexArrayObject
  aPos: GLint // 'a_pos' vec4 attribute
  offset: WebGLUniformLocation
  radius: WebGLUniformLocation
  update: boolean = true
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, shadeVertex, shadeFragment, false)
    // acquire the attributes & uniforms
    this.aPos = gl.getAttribLocation(this.glProgram, 'aPos')
    this.offset = gl.getUniformLocation(this.glProgram, 'uOffset')
    this.radius = gl.getUniformLocation(this.glProgram, 'uRadius')
    // create a vertex array object
    this.vao = context.createVertexArray()
    // bind the vao so we can work on it
    context.bindVertexArray(this.vao)
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
