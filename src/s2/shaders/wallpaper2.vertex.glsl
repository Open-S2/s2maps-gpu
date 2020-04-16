#version 300 es
precision mediump float;

in vec2 aPos;
out vec2 vertPos;

// all shaders have a main function
void main () {
  vertPos = aPos;
  // Multiply the position by the matrix.
  gl_Position = vec4(aPos, 1., 1.);
}
