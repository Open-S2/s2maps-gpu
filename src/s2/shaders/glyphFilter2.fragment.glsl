#version 300 es
precision mediump float;

in vec4 color;
out vec4 fragColor;

void main () {
  if (color.a <= 0.01) discard;
  fragColor = color;
}
