// @flow
import Painter from '../painter'
import loadShader from './loadShader'

import type { FeatureGuide } from '../../source/tile'
export type ProgramTypes = 'mask' | 'fill' | 'line' | 'fill3D' | 'line3D'

export default class Program {
  radii: boolean = false
  compiled: boolean = false
  linked: boolean = false
  gl: WebGLRenderingContext
  glProgram: WebGLProgram
  uMatrix: WebGLUniformLocation
  uMode: WebGLUniformLocation
  u3D: WebGLUniformLocation
  uFaceST: WebGLUniformLocation
  uInputs: WebGLUniformLocation
  uLayerCode: WebGLUniformLocation
  uFeatureCode: WebGLUniformLocation
  updateMatrix: Float32Array // pointer
  updateInputs: Float32Array // pointer
  curMode: number = -1
  threeD: boolean
  constructor (gl: WebGLRenderingContext, vertexShaderSource: string, fragmentShaderSource: string, defaultUniforms?: boolean = true) {
    const program = this.glProgram = gl.createProgram()
    const vertexShader = loadShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = loadShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)

    if (vertexShader && fragmentShader) {
      this.compiled = true
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const lastError = gl.getProgramInfoLog(program)
        throw Error(lastError)
      }
      this.linked = true
      // if we made it here, link gl
      this.gl = gl
    } else { throw Error('missing shaders') }
    // now build uniforms
    if (defaultUniforms) {
      // get uniform locations
      this.uMatrix = gl.getUniformLocation(program, 'uMatrix')
      this.uMode = gl.getUniformLocation(program, 'uMode')
      this.u3D = gl.getUniformLocation(program, 'u3D')
      this.uFaceST = gl.getUniformLocation(program, 'uFaceST')
      this.uInputs = gl.getUniformLocation(program, 'uInputs')
      this.uLayerCode = gl.getUniformLocation(program, 'uLayerCode')
      this.uFeatureCode = gl.getUniformLocation(program, 'uFeatureCode')
    }
  }

  use () {
    this.gl.useProgram(this.glProgram)
    this.flush()
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array) {
    if (matrix && this.uMatrix) this.updateMatrix = matrix
    if (view && this.uInputs) this.updateInputs = view
  }

  flush () {
    if (this.updateMatrix) this.setMatrix(this.updateMatrix)
    if (this.updateInputs) this.setInputs(this.updateInputs)
  }

  setMatrix (matrix: Float32Array) {
    this.gl.uniformMatrix4fv(this.uMatrix, false, matrix)
    // flush update pointers
    this.updateMatrix = null
  }

  setInputs (inputs: Float32Array) {
    this.gl.uniform1fv(this.uInputs, inputs, 0, inputs.length)
    this.updateInputs = null // ensure updateInputs is "flushed"
  }

  setFaceST (faceST: Float32Array) {
    this.gl.uniform1fv(this.uFaceST, faceST, 0, faceST.length)
  }

  setLayerCode (layerCode: Float32Array) {
    this.gl.uniform1fv(this.uLayerCode, layerCode, 0, layerCode.length)
  }

  set3D (state?: boolean = false) {
    if (this.u3D && this.threeD !== state) {
      this.threeD = state
      this.gl.uniform1i(this.u3D, state)
    }
  }

  setMode (mode: number) {
    if (this.curMode !== mode) {
      // update current value
      this.curMode = mode
      // update gpu uniform
      this.gl.uniform1i(this.uMode, mode)
    }
  }

  draw (painter: Painter, featureGuide: FeatureGuide) {
    // grab context
    const { context } = painter
    const { gl } = context
    // get current source data
    let { count, featureCode, offset, mode, threeD } = featureGuide
    // set 3D uniform
    this.set3D(threeD)
    // set feature code
    if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
    // get mode
    if (!mode) mode = gl.TRIANGLES
    // draw elements
    gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  }
}
