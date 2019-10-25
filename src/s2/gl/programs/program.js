// @flow
export default class Program {
  vao: VertexArrayObject
  vertexBuffer: WebGLVertexArrayObject
  compiled: boolean = false
  linked: boolean = false
  glProgram: WebGLProgram
  constructor (gl: WebGLRenderingContext, vertexShaderSource: string, fragmentShaderSource: string) {
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
        console.log(lastError)
      }
      this.linked = true
    }
  }
}

function loadShader(gl: WebGLRenderingContext, shaderSource: string, shaderType: number) {
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
