// @flow
export type ProgramTypes = 'mask' | 'fill' | 'line' | 'fill3D' | 'line3D'

export default class Program {
  compiled: boolean = false
  linked: boolean = false
  gl: WebGLRenderingContext
  glProgram: WebGLProgram
  uniforms3D: boolean
  uniformsCode: boolean
  matrix: GLuint
  eyePosHigh: GLuint
  eyePosLow: GLuint
  inputs: GLuint
  layerCode: GLuint
  featureCode: GLuint
  updateMatrix: Float32Array // pointer
  updateEyeHigh: Float32Array // pointer
  updateEyeLow: Float32Array // pointer
  updateInputs: Float32Array // pointer
  constructor (gl: WebGLRenderingContext, vertexShaderSource: string,
    fragmentShaderSource: string, uniforms3D: boolean, uniformsCode: boolean) {
    const program = this.glProgram = gl.createProgram()
    const vertexShader = loadShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = loadShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER)
    this.uniforms3D = uniforms3D
    this.uniformsCode = uniformsCode

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
    if (uniforms3D) {
      this.matrix = gl.getUniformLocation(program, 'uMatrix')
      this.eyePosHigh = gl.getUniformLocation(program, 'uEyePosHigh')
      this.eyePosLow = gl.getUniformLocation(program, 'uEyePosLow')
    }
    if (uniformsCode) {
      this.inputs = gl.getUniformLocation(program, 'uInputs')
      this.layerCode = gl.getUniformLocation(program, 'uLayerCode')
      this.featureCode = gl.getUniformLocation(program, 'uFeatureCode')
    }
  }

  use () {
    this.gl.useProgram(this.glProgram)
  }

  injectFrameUniforms (matrix: Float32Array, eyePosHigh: Float32Array,
    eyePosLow: Float32Array, view: Float32Array) {
    if (this.uniforms3D) {
      this.updateMatrix = matrix
      this.updateEyeHigh = eyePosHigh
      this.updateEyeLow = eyePosLow
    }
    if (this.uniformsCode) {
      this.updateInputs = view
    }
  }

  flush () {
    if (this.updateMatrix) this.setMatrix(this.updateMatrix, this.updateEyeHigh, this.updateEyeLow)
    if (this.updateInputs) this.setInputs(this.updateInputs)
  }

  setMatrix (matrix: Float32Array, eyeHigh: Float32Array, eyeLow: Float32Array) {
    if (this.uniforms3D) {
      this.gl.uniformMatrix4fv(this.matrix, false, matrix)
      this.gl.uniform3fv(this.eyePosHigh, eyeHigh)
      this.gl.uniform3fv(this.eyePosLow, eyeLow)
      // flush update pointers
      this.updateMatrix = null
      this.updateEyeHigh = null
      this.updateEyeLow = null
    }
  }

  setInputs (inputs: Float32Array) {
    this.gl.uniform1fv(this.inputs, inputs, 0, inputs.length)
    this.updateInputs = null // ensure updateInputs is "flushed"
  }

  setLayerCode (layerCode: Float32Array) {
    if (this.uniformsCode) {
      this.gl.uniform1fv(this.layerCode, layerCode, 0, layerCode.length)
    }
  }
}

function loadShader (gl: WebGLRenderingContext, shaderSource: string, shaderType: number) {
  // Create the shader object
  const shader = gl.createShader(shaderType)
  // Load the shader source
  gl.shaderSource(shader, shaderSource)
  // Compile the shader
  gl.compileShader(shader)
  // Check the compile status
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!compiled) {
    // Something went wrong during compilation get the error
    const lastError = gl.getShaderInfoLog(shader)
    console.log("*** Error compiling shader '" + shader + "':" + lastError)
    gl.deleteShader(shader)
    return null
  }

  return shader
}
