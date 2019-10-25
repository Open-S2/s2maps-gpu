#version 300 es
precision highp float;

in vec3 aPos;

void main () {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * vec4(aPos, 1);
}
