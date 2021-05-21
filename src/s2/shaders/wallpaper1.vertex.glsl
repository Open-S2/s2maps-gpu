#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;
varying vec2 vertPos;

// all shaders have a main function
void main () {
  vertPos = aPos;
  // Multiply the position by the matrix.
  gl_Position = vec4(aPos, 1., 1.);
}
