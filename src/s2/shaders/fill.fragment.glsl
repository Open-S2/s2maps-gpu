#version 300 es
precision highp float;

@import ./color;

in vec4 color;
out vec4 fragColor;

void main () {
  vec4 c = LCH2RGB(color);
  if (c.a < 0.01) discard;
  fragColor = c;
}
