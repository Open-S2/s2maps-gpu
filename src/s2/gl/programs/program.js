// @flow
import loadShader from './loadShader'

export type ProgramTypes = 'mask' | 'fill' | 'line' | 'fill3D' | 'line3D'

export default class Program {
  compiled: boolean = false
  linked: boolean = false
  gl: WebGLRenderingContext
  glProgram: WebGLProgram
  matrix: GLuint
  faceST: GLuint
  inputs: GLuint
  layerCode: GLuint
  featureCode: GLuint
  updateMatrix: Float32Array // pointer
  updateFaceST: Float32Array // pointer
  updateInputs: Float32Array // pointer
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
      this.matrix = gl.getUniformLocation(program, 'uMatrix')
      this.faceST = gl.getUniformLocation(program, 'uFaceST')
      this.inputs = gl.getUniformLocation(program, 'uInputs')
      this.layerCode = gl.getUniformLocation(program, 'uLayerCode')
      this.featureCode = gl.getUniformLocation(program, 'uFeatureCode')
    }
  }

  use () {
    this.gl.useProgram(this.glProgram)
    this.flush()
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, faceST: Float32Array) {
    if (matrix) this.updateMatrix = matrix
    if (view) this.updateInputs = view
    if (faceST) this.updateFaceST = faceST
  }

  flush () {
    if (this.updateMatrix) this.setMatrix(this.updateMatrix)
    if (this.updateInputs) this.setInputs(this.updateInputs)
    if (this.updateFaceST) this.setFaceST(this.updateFaceST)
  }

  setMatrix (matrix: Float32Array) {
    this.gl.uniformMatrix4fv(this.matrix, false, matrix)
    // flush update pointers
    this.updateMatrix = null
  }

  setInputs (inputs: Float32Array) {
    this.gl.uniform1fv(this.inputs, inputs, 0, inputs.length)
    this.updateInputs = null // ensure updateInputs is "flushed"
  }

  setFaceST (faceST: Float32Array) {
    this.gl.uniform1fv(this.faceST, faceST, 0, faceST.length)
    this.updateFaceST = null // ensure updateInputs is "flushed"
  }

  setLayerCode (layerCode: Float32Array) {
    this.gl.uniform1fv(this.layerCode, layerCode, 0, layerCode.length)
  }
}
