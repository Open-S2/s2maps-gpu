#version 300 es

// https://stackoverflow.com/questions/137629/how-do-you-render-primitives-as-wireframes-in-opengl

precision mediump float;

// the varied color passed from the vertex shader
in vec4 v_color;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  outColor = v_color;
}
