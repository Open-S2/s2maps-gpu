#version 300 es
precision mediump float;

in vec3 aPos;

uniform mat4 uMatrix;

void main () {
  // Multiply the position by the matrix.
  gl_Position = uMatrix * vec4(aPos, 1);
}
