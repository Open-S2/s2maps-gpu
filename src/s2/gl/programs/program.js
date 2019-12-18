// @flow
export type ProgramTypes = 'fill' | 'line'

export default class Program {
  compiled: boolean = false
  linked: boolean = false
  gl: WebGLRenderingContext
  glProgram: WebGLProgram
  matrix: GLuint
  eyePosHigh: GLuint
  eyePosLow: GLuint
  inputs: GLuint
  layerCode: GLuint
  featureCode: GLuint
  constructor (gl: WebGLRenderingContext, vertexShaderSource: string, fragmentShaderSource: string, buildUniforms?: boolean = true) {
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
    if (buildUniforms) {
      this.matrix = gl.getUniformLocation(program, 'uMatrix')
      this.eyePosHigh = gl.getUniformLocation(program, 'uEyePosHigh')
      this.eyePosLow = gl.getUniformLocation(program, 'uEyePosLow')
      this.inputs = gl.getUniformLocation(program, 'uInputs')
      this.layerCode = gl.getUniformLocation(program, 'uLayerCode')
      this.featureCode = gl.getUniformLocation(program, 'uFeatureCode')
    }
  }

  use () {
    this.gl.useProgram(this.glProgram)
  }

  setMatrix (matrix: Float32Array, eyeHigh: Float32Array, eyeLow: Float32Array) {
    this.gl.uniformMatrix4fv(this.matrix, false, matrix)
    this.gl.uniform3fv(this.eyePosHigh, eyeHigh)
    this.gl.uniform3fv(this.eyePosLow, eyeLow)
  }

  setInputs (inputs: Float32Array) {
    this.gl.uniform1fv(this.inputs, inputs, 0, inputs.length)
  }

  setLayerCode (layerCode: Float32Array) {
    this.gl.uniform1fv(this.layerCode, layerCode, 0, layerCode.length)
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
