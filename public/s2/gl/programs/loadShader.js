// @flow
/* eslint-env browser */
export default function loadShader (gl: WebGLRenderingContext, shaderSource: string, shaderType: number) {
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
    console.log(`*** Error compiling shader '${shader}': ${lastError}`)
    gl.deleteShader(shader)
    return null
  }

  return shader
}
