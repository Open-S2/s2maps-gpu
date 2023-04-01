declare module '*.glsl' {
  const shader: {
    source: string
    uniforms: { [key: string]: string }
    attributes: { [key: string]: string }
  }
  export default shader
}
