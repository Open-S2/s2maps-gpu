declare module '*.glsl' {
  const shader: {
    source: string;
    uniforms: Record<string, string>;
    attributes: Record<string, string>;
  };
  export default shader;
}
