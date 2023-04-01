/* eslint-env browser */
export default function loadShader (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  shaderSource: string,
  shaderType: number
): WebGLShader {
  // Create the shader object
  const shader = gl.createShader(shaderType)
  if (shader === null) throw Error(`Failed to create shader : ${shaderSource}`)
  // Load the shader source
  gl.shaderSource(shader, shaderSource)
  // Compile the shader
  gl.compileShader(shader)
  // Check the compile status
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (compiled === null) {
    // Something went wrong during compilation get the error
    const lastError = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw Error(`*** Error compiling shader '${JSON.stringify(shader)}': ${lastError ?? 'unknown'}`)
  }

  return shader
}
