#version 300 es
precision highp float;

in vec4 a_pos;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main () {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_pos;
  // Pass the color to the fragment shader.
  v_color = a_color;
}
